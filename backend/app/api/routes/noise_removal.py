"""
Background Noise Removal & Source Separation Routes
"""
import os, logging
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, List

from app.core.database import get_db
from app.core.config import settings
from app.models.audio import Audio
from app.services.enhancement_service import enhancement_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["noise-removal", "source-separation"])

EXPORT_FORMATS = {"wav": "audio/wav", "flac": "audio/flac",
                  "ogg": "audio/ogg", "mp3": "audio/mpeg"}


class NoiseRemovalRequest(BaseModel):
    audio_id:            int
    aggressiveness:      float = Field(default=0.75, ge=0.1, le=1.0,
                                       description="0.1=gentle, 1.0=max removal")
    noise_estimate_secs: float = Field(default=0.5, ge=0.1, le=5.0,
                                       description="Seconds to use as noise profile")

class SourceSeparationRequest(BaseModel):
    audio_id: int
    stems: List[str] = Field(
        default=["vocals", "drums", "bass", "other"],
        description="Which stems to extract"
    )


def _get_audio_or_404(aid: int, db: Session) -> Audio:
    a = db.query(Audio).filter(Audio.id == aid).first()
    if not a:
        raise HTTPException(404, f"Audio {aid} not found")
    return a

def _require_file(path):
    if not path or not os.path.exists(path):
        raise HTTPException(404, "Audio file not found on disk")


@router.post("/noise-removal", summary="Remove background noise")
async def remove_background_noise(
    req: NoiseRemovalRequest,
    db: Session = Depends(get_db),
):
    """
    Adaptive background noise removal using the noisereduce MMSE algorithm.
    More conservative than full enhancement — preserves naturalness and
    avoids speech artefacts.
    """
    audio_rec = _get_audio_or_404(req.audio_id, db)
    _require_file(audio_rec.original_path)

    base       = os.path.splitext(audio_rec.filename)[0]
    out_path   = os.path.join(settings.UPLOAD_DIR, "enhanced",
                              f"{base}_denoised.wav")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    try:
        result = enhancement_service.remove_background_noise(
            audio_path          = audio_rec.original_path,
            output_path         = out_path,
            aggressiveness      = req.aggressiveness,
            noise_estimate_secs = req.noise_estimate_secs,
        )
    except Exception as exc:
        logger.exception("Noise removal failed for audio %d", req.audio_id)
        raise HTTPException(500, f"Noise removal failed: {exc}")

    # Persist
    try:
        audio_rec.enhanced_path = out_path
        audio_rec.enhanced      = True
        db.commit()
    except Exception:
        db.rollback()

    return {
        "audio_id":    req.audio_id,
        "output_url":  f"/uploads/enhanced/{base}_denoised.wav",
        "metrics":     result["metrics"],
        "processing_time": result["processing_time"],
    }


@router.post("/separate", summary="Separate audio into stems")
async def separate_sources(
    req: SourceSeparationRequest,
    db: Session = Depends(get_db),
):
    """
    Separate audio into up to 4 stems: vocals, drums, bass, other.
    Each stem is returned as a downloadable WAV file URL.
    """
    audio_rec = _get_audio_or_404(req.audio_id, db)
    src = audio_rec.enhanced_path or audio_rec.original_path
    _require_file(src)

    valid = {"vocals", "drums", "bass", "other"}
    stems = [s for s in req.stems if s in valid]
    if not stems:
        raise HTTPException(400, f"Valid stems: {sorted(valid)}")

    base    = os.path.splitext(audio_rec.filename)[0]
    out_dir = os.path.join(settings.UPLOAD_DIR, "stems", base)

    try:
        result = enhancement_service.separate_sources(
            audio_path = src,
            output_dir = out_dir,
            stems      = stems,
        )
    except Exception as exc:
        logger.exception("Source separation failed for audio %d", req.audio_id)
        raise HTTPException(500, f"Source separation failed: {exc}")

    return {
        "audio_id":        req.audio_id,
        "stems":           result["stems"],
        "processing_time": result["processing_time"],
    }


@router.get("/separate/{audio_id}/{stem}", summary="Download a separated stem")
async def download_stem(
    audio_id: int, stem: str,
    fmt: str = Query(default="wav"),
    db: Session = Depends(get_db),
):
    audio_rec = _get_audio_or_404(audio_id, db)
    base      = os.path.splitext(audio_rec.filename)[0]
    stem_path = os.path.join(settings.UPLOAD_DIR, "stems", base, f"{stem}.wav")

    if not os.path.exists(stem_path):
        raise HTTPException(404, f"Stem '{stem}' not found. Run separation first.")

    fmt = fmt.lower().strip(".")
    if fmt == "wav":
        return FileResponse(stem_path, media_type="audio/wav",
                            filename=f"{stem}_{audio_rec.filename}")
    try:
        import torchaudio, torch, soundfile as sf
        import numpy as np
        audio, sr = sf.read(stem_path)
        t = torch.from_numpy(audio.T if audio.ndim == 2 else audio.reshape(1,-1)).float()
        import tempfile
        tmp = tempfile.NamedTemporaryFile(suffix=f".{fmt}", delete=False)
        tmp.close()
        torchaudio.save(tmp.name, t, sr)
        return FileResponse(tmp.name,
                            media_type=EXPORT_FORMATS.get(fmt, "audio/wav"),
                            filename=f"{stem}_{base}.{fmt}")
    except Exception as exc:
        raise HTTPException(500, f"Format conversion failed: {exc}")
