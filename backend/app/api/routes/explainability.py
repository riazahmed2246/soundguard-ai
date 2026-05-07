import json
import os
import logging

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.audio import Audio
from app.services.explainability_service import explainability_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/explain", tags=["explainability"])


# ─── Helper ───────────────────────────────────────────────────────────────────

def _get_audio_or_404(audio_id: int, db: Session) -> Audio:
    audio = db.query(Audio).filter(Audio.id == audio_id).first()
    if not audio:
        raise HTTPException(status_code=404, detail=f"Audio {audio_id} not found.")
    return audio


# ─── Explain / generate spectrograms ─────────────────────────────────────────

@router.post(
    "/",
    summary="Generate explainability report with spectrograms",
)
async def explain_denoising(
    request: dict,
    db: Session = Depends(get_db),
):
    """
    Generate spectrogram images (before/after) and AI noise-detection cards
    for the given audio file.

    Requires ``audio_id`` in the request body.  If enhancement has already
    been run the enhanced spectrogram is included automatically.
    """
    audio_id = request.get("audio_id")
    if not audio_id:
        raise HTTPException(status_code=400, detail="audio_id is required.")

    audio = _get_audio_or_404(int(audio_id), db)

    if not audio.original_path or not os.path.exists(audio.original_path):
        raise HTTPException(status_code=404, detail="Original audio file not found on disk.")

    try:
        result = explainability_service.explain_denoising(
            original_path = audio.original_path,
            enhanced_path = audio.enhanced_path,
        )
    except Exception as exc:
        logger.exception("Explainability failed for audio %s", audio_id)
        raise HTTPException(status_code=500, detail=f"Explainability generation failed: {exc}")

    # Persist (non-fatal on error)
    try:
        audio.explainability_results = json.dumps(result)
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.error("DB update failed after explainability: %s", exc)

    return result


# ─── Retrieve cached result ───────────────────────────────────────────────────

@router.get(
    "/{audio_id}",
    summary="Get previously generated explainability results",
)
async def get_explainability_results(
    audio_id: int,
    db: Session = Depends(get_db),
):
    audio = _get_audio_or_404(audio_id, db)
    if not audio.explainability_results:
        return {"message": "Explainability analysis not performed yet."}
    return json.loads(audio.explainability_results)
