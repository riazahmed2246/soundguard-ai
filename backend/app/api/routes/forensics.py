from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.audio import Audio
from app.schemas.audio import ForensicsRequest, ForensicsResponse, Detection
from app.services.forensics_service import forensics_service
import os
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/forensics", tags=["forensics"])


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _get_audio_or_404(audio_id: int, db: Session) -> Audio:
    audio = db.query(Audio).filter(Audio.id == audio_id).first()
    if not audio:
        raise HTTPException(status_code=404, detail=f"Audio {audio_id} not found.")
    return audio


def _require_file(path: str) -> None:
    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Audio file not found on disk.")


# ─── Detect ───────────────────────────────────────────────────────────────────

@router.post(
    "/detect",
    response_model=ForensicsResponse,
    summary="Detect audio tampering / manipulation",
    status_code=200,
)
async def detect_tampering(
    request: ForensicsRequest,
    db: Session = Depends(get_db),
):
    """
    Run the complete forensic pipeline on an uploaded audio file.

    Returns an authenticity score (0–100), a status label, a list of
    timestamped detections (splices / edits), and a human-readable summary.

    | Score  | Status            |
    |--------|-------------------|
    | 86-100 | authentic         |
    | 71-85  | suspicious        |
    | 41-70  | modified          |
    | 0-40   | severely_modified |
    """
    audio = _get_audio_or_404(request.audio_id, db)
    _require_file(audio.original_path)

    try:
        result = forensics_service.analyze_audio(audio.original_path)
    except Exception as exc:
        logger.exception("Forensic analysis failed for audio %d", request.audio_id)
        raise HTTPException(status_code=500, detail=f"Forensic analysis failed: {exc}")

    # Persist to DB (non-fatal on error)
    try:
        audio.update_forensics_results(result)
        db.commit()
        db.refresh(audio)
    except Exception as exc:
        db.rollback()
        logger.error("DB update failed after forensics: %s", exc)

    return ForensicsResponse(
        audio_id           = audio.id,
        authenticity_score = result["authenticity_score"],
        status             = result["status"],
        detections         = [Detection(**d) for d in result["detections"]],
        summary            = result["summary"],
    )


# ─── Retrieve cached result ───────────────────────────────────────────────────

@router.get(
    "/{audio_id}/forensics",
    summary="Get previously calculated forensics results",
)
async def get_forensics_results(
    audio_id: int,
    db: Session = Depends(get_db),
):
    """Return stored forensics payload or a 'not analysed yet' message."""
    audio = _get_audio_or_404(audio_id, db)
    if not audio.forensics_results:
        return {"message": "Forensic analysis not performed yet for this audio file."}
    return json.loads(audio.forensics_results)


# ─── Timeline ─────────────────────────────────────────────────────────────────

@router.get(
    "/{audio_id}/timeline",
    summary="Get forensic timeline for visualization",
)
async def get_timeline(
    audio_id: int,
    db: Session = Depends(get_db),
):
    """
    Build a timeline payload from stored forensics data, ready for the
    frontend waveform overlay.  Returns ``sections`` (authentic / tampered
    colour bands) and ``markers`` (pinpoint detection events).
    """
    audio = _get_audio_or_404(audio_id, db)
    if not audio.forensics_results:
        return {"message": "Forensic analysis not performed yet for this audio file."}

    forensics   = json.loads(audio.forensics_results)
    duration    = float(audio.duration or 0)
    detections  = sorted(
        forensics.get("detections", []),
        key=lambda d: d["timestamp"],
    )

    sections: list = []
    markers:  list = []
    cursor = 0.0

    for det in detections:
        ts = float(det["timestamp"])
        if ts > cursor:
            sections.append({"start": round(cursor, 3), "end": round(ts, 3), "status": "authentic"})

        # Narrow tampered window around the detection (±0.1 s)
        t_start = max(cursor, ts - 0.10)
        t_end   = min(duration, ts + 0.10)
        sections.append({"start": round(t_start, 3), "end": round(t_end, 3), "status": "tampered"})
        cursor = t_end

        markers.append({
            "timestamp": round(ts, 3),
            "type":      det["type"],
            "severity":  det["severity"],
            "confidence": det["confidence"],
        })

    if cursor < duration:
        sections.append({"start": round(cursor, 3), "end": round(duration, 3), "status": "authentic"})

    return {
        "audio_id":           audio_id,
        "duration":           round(duration, 3),
        "authenticity_score": forensics.get("authenticity_score"),
        "status":             forensics.get("status"),
        "sections":           sections,
        "markers":            markers,
    }
