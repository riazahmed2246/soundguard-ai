from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.audio import Audio
from app.schemas.audio import AQIRequest, AQIResponse, AQIMetrics
from app.services.aqi_service import aqi_service
import os
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/aqi", tags=["aqi"])


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _get_audio_or_404(audio_id: int, db: Session) -> Audio:
    audio = db.query(Audio).filter(Audio.id == audio_id).first()
    if not audio:
        raise HTTPException(status_code=404, detail=f"Audio {audio_id} not found.")
    return audio


def _require_file(path: str) -> None:
    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Audio file not found on disk.")


# ─── Calculate ────────────────────────────────────────────────────────────────

@router.post(
    "/calculate",
    response_model=AQIResponse,
    summary="Calculate Audio Quality Index",
    status_code=200,
)
async def calculate_aqi(
    request: AQIRequest,
    db: Session = Depends(get_db),
):
    """
    Compute all six AQI dimensions for an uploaded audio file and return
    the overall 0–100 score plus per-metric breakdown.

    Six metrics: **SNR**, **Clarity**, **Distortion**, **Frequency Response**,
    **Dynamic Range**, **Noise Floor**.
    """
    audio = _get_audio_or_404(request.audio_id, db)
    _require_file(audio.original_path)

    try:
        result = aqi_service.calculate_aqi(audio.original_path)
    except Exception as exc:
        logger.exception("AQI calculation failed for audio %d", request.audio_id)
        raise HTTPException(status_code=500, detail=f"AQI calculation failed: {exc}")

    # Persist to DB (non-fatal on error)
    try:
        audio.update_aqi_results(result)
        db.commit()
        db.refresh(audio)
    except Exception as exc:
        db.rollback()
        logger.error("DB update failed after AQI: %s", exc)

    m = result["metrics"]
    return AQIResponse(
        audio_id      = audio.id,
        overall_score = result["overall_score"],
        status        = result["status"],
        metrics       = AQIMetrics(
            snr                = m["snr"],
            clarity            = m["clarity"],
            distortion         = m["distortion"],
            frequency_response = m["frequency_response"],
            dynamic_range      = m["dynamic_range"],
            noise_floor        = m["noise_floor"],
        ),
    )


# ─── Retrieve cached result ───────────────────────────────────────────────────

@router.get(
    "/{audio_id}/aqi",
    summary="Get previously calculated AQI results",
)
async def get_aqi_results(
    audio_id: int,
    db: Session = Depends(get_db),
):
    """Return the stored AQI payload or a 'not calculated yet' message."""
    audio = _get_audio_or_404(audio_id, db)
    if not audio.aqi_results:
        return {"message": "AQI not calculated yet for this audio file."}
    return json.loads(audio.aqi_results)
