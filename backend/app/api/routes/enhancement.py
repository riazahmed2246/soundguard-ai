import os
import tempfile
import logging

from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.models.audio import Audio
from app.schemas.audio import EnhancementRequest, EnhancementResponse, EnhancementMetrics
from app.services.enhancement_service import enhancement_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["enhancement"])

# Supported export formats and their MIME types
EXPORT_FORMATS = {
    "wav":  "audio/wav",
    "flac": "audio/flac",
    "ogg":  "audio/ogg",
    "mp3":  "audio/mpeg",
    "aac":  "audio/aac",
    "m4a":  "audio/mp4",
}


def _get_audio_or_404(audio_id: int, db: Session) -> Audio:
    audio = db.query(Audio).filter(Audio.id == audio_id).first()
    if not audio:
        raise HTTPException(status_code=404, detail=f"Audio {audio_id} not found.")
    return audio


def _require_file(path: str, label: str = "file") -> None:
    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"{label} not found on disk.")


@router.post("/enhance", response_model=EnhancementResponse,
             summary="Enhance audio using AI / DSP model")
async def enhance_audio(request: EnhancementRequest, db: Session = Depends(get_db)):
    audio = _get_audio_or_404(request.audio_id, db)
    _require_file(audio.original_path, "Original audio")

    base             = os.path.splitext(audio.filename)[0]
    enhanced_fname   = f"{base}_enhanced.wav"
    enhanced_path    = os.path.join(settings.UPLOAD_DIR, "enhanced", enhanced_fname)
    os.makedirs(os.path.dirname(enhanced_path), exist_ok=True)

    try:
        result = enhancement_service.enhance_audio(
            audio_path      = audio.original_path,
            output_path     = enhanced_path,
            model_name      = request.model.value,
            noise_reduction = request.noise_reduction,
            preserve_speech = request.preserve_speech,
            mode            = request.mode.value,
        )
    except Exception as exc:
        logger.exception("Enhancement failed for audio %d", request.audio_id)
        raise HTTPException(status_code=500, detail=f"Enhancement failed: {exc}")

    try:
        audio.enhanced_path     = enhanced_path
        audio.enhanced          = True
        audio.enhancement_model = request.model.value
        audio.update_enhancement_results({
            **result["metrics"], "model": request.model.value, "mode": request.mode.value,
        })
        db.commit(); db.refresh(audio)
    except Exception as exc:
        db.rollback()
        logger.error("DB update failed after enhancement: %s", exc)

    raw = result["metrics"]
    return EnhancementResponse(
        audio_id       = audio.id,
        enhanced_url   = f"/uploads/enhanced/{enhanced_fname}",
        metrics        = EnhancementMetrics(
            noise_reduced       = raw.get("noise_reduced", 0.0),
            snr_improvement     = raw.get("snr_improvement", 0.0),
            clarity_improvement = raw.get("clarity_improvement", 0.0),
            processing_time     = raw.get("processing_time", result["processing_time"]),
        ),
        processing_time = result["processing_time"],
    )


@router.get("/enhance/{audio_id}/download",
            summary="Download enhanced audio in any supported format")
async def download_enhanced(
    audio_id: int,
    format: str = Query(
        default="wav",
        description=f"Export format: {', '.join(EXPORT_FORMATS.keys())}",
    ),
    db: Session = Depends(get_db),
):
    """
    Stream the enhanced audio file.  Pass ``?format=flac``, ``?format=mp3``,
    ``?format=ogg``, ``?format=aac``, or ``?format=m4a`` to convert on the fly
    via torchaudio before download.
    """
    audio = _get_audio_or_404(audio_id, db)
    _require_file(audio.enhanced_path, "Enhanced audio")

    fmt = format.lower().strip(".")
    if fmt not in EXPORT_FORMATS:
        raise HTTPException(status_code=400,
            detail=f"Unsupported export format '{fmt}'. Choose from: {', '.join(EXPORT_FORMATS)}")

    base     = os.path.splitext(os.path.basename(audio.enhanced_path))[0]
    out_name = f"{base}.{fmt}"
    mime     = EXPORT_FORMATS[fmt]

    # WAV → serve directly (no conversion needed)
    if fmt == "wav":
        return FileResponse(audio.enhanced_path, media_type=mime, filename=out_name)

    # Other formats → convert via torchaudio
    try:
        import torchaudio
        waveform, sr = torchaudio.load(audio.enhanced_path)
        tmp = tempfile.NamedTemporaryFile(suffix=f".{fmt}", delete=False)
        tmp.close()
        torchaudio.save(tmp.name, waveform, sr)
        return FileResponse(tmp.name, media_type=mime, filename=out_name,
                            background=_cleanup_temp(tmp.name))
    except Exception as exc:
        logger.exception("Export conversion to %s failed", fmt)
        raise HTTPException(status_code=500, detail=f"Export to {fmt} failed: {exc}")


def _cleanup_temp(path: str):
    """Return a BackgroundTask that deletes a temp file after the response is sent."""
    from starlette.background import BackgroundTask
    return BackgroundTask(lambda: os.unlink(path) if os.path.exists(path) else None)


@router.get("/enhance/{audio_id}/compare", summary="Compare original and enhanced metrics")
async def compare_versions(audio_id: int, db: Session = Depends(get_db)):
    audio = _get_audio_or_404(audio_id, db)
    if not audio.enhanced_path:
        raise HTTPException(status_code=400,
            detail="No enhanced version available. Run enhancement first.")
    _require_file(audio.enhanced_path, "Enhanced audio")
    try:
        return enhancement_service.compare_audio(audio.original_path, audio.enhanced_path)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Comparison failed: {exc}")
