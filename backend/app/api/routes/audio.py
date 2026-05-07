from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.config import settings
from app.models.audio import Audio
from app.schemas.audio import AudioResponse, MessageResponse
import librosa
import os
import shutil
import logging
from datetime import datetime
from pathlib import Path
import uuid

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["audio"])


def _safe_remove(*paths: str) -> None:
    for p in paths:
        if p and os.path.exists(p):
            try:
                os.remove(p)
            except OSError as exc:
                logger.warning("Could not remove file %s: %s", p, exc)


def _validate_extension(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"File type '{ext}' is not supported. "
                f"Supported formats: {', '.join(sorted(settings.ALLOWED_EXTENSIONS))}"
            ),
        )
    return ext


def _unique_filename(original: str, ext: str) -> str:
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    uid = uuid.uuid4().hex[:6]
    stem = Path(original).stem
    safe_stem = "".join(c if (c.isalnum() or c in "_-") else "_" for c in stem)[:40]
    return f"{ts}_{uid}_{safe_stem}{ext}"


@router.post("/upload", response_model=AudioResponse, summary="Upload an audio file", status_code=201)
async def upload_audio(
    file: UploadFile = File(..., description="Any supported audio format"),
    db: Session = Depends(get_db),
):
    ext = _validate_extension(file.filename or "")
    filename  = _unique_filename(file.filename, ext)
    file_path = os.path.join(settings.UPLOAD_DIR, filename)

    try:
        with open(file_path, "wb") as buf:
            shutil.copyfileobj(file.file, buf)
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {exc}")
    finally:
        await file.close()

    file_size = os.path.getsize(file_path)
    if file_size > settings.MAX_UPLOAD_SIZE:
        _safe_remove(file_path)
        raise HTTPException(status_code=413,
            detail=f"File too large. Maximum is {settings.MAX_UPLOAD_SIZE // (1024*1024)} MB.")
    if file_size == 0:
        _safe_remove(file_path)
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # Primary loader: librosa (WAV/MP3/FLAC/OGG/AIFF/AU …)
    # Fallback: torchaudio (AAC/WMA/OPUS/M4A/MP4/WEBM/AMR …)
    sample_rate = duration = channels = bitrate = None
    try:
        audio_data, sample_rate = librosa.load(file_path, sr=None, mono=False)
        duration = float(librosa.get_duration(y=audio_data, sr=sample_rate))
        channels = 1 if audio_data.ndim == 1 else int(audio_data.shape[0])
    except Exception as librosa_exc:
        logger.warning("librosa failed for '%s' (%s) – trying torchaudio", filename, librosa_exc)
        try:
            import torchaudio
            waveform, sample_rate = torchaudio.load(file_path)
            duration = float(waveform.shape[1] / sample_rate)
            channels = int(waveform.shape[0])
        except Exception as ta_exc:
            _safe_remove(file_path)
            raise HTTPException(status_code=400,
                detail=f"Could not decode '{ext}' file. Ensure it is a valid audio file. ({ta_exc})")

    bitrate = int((file_size * 8) / duration) if duration and duration > 0 else None

    audio = Audio(
        filename=filename, original_path=file_path,
        format=ext.lstrip(".").upper(),
        duration=duration, sample_rate=sample_rate,
        channels=channels, file_size=file_size, bitrate=bitrate,
    )
    try:
        db.add(audio); db.commit(); db.refresh(audio)
    except Exception as exc:
        _safe_remove(file_path); db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")

    logger.info("Uploaded: id=%d  file=%s  dur=%.2fs  sr=%d  ch=%d",
                audio.id, filename, duration, sample_rate, channels)
    return audio


@router.get("/audio/{audio_id}", response_model=AudioResponse, summary="Get audio metadata")
async def get_audio(audio_id: int, db: Session = Depends(get_db)):
    audio = db.query(Audio).filter(Audio.id == audio_id).first()
    if not audio:
        raise HTTPException(status_code=404, detail=f"Audio {audio_id} not found.")
    return audio


@router.get("/audio", response_model=list[AudioResponse], summary="List all audio records")
async def list_audio(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    return db.query(Audio).order_by(Audio.upload_date.desc()).offset(skip).limit(limit).all()


@router.delete("/audio/{audio_id}", response_model=MessageResponse, summary="Delete audio")
async def delete_audio(audio_id: int, db: Session = Depends(get_db)):
    audio = db.query(Audio).filter(Audio.id == audio_id).first()
    if not audio:
        raise HTTPException(status_code=404, detail=f"Audio {audio_id} not found.")
    _safe_remove(audio.original_path, audio.enhanced_path)
    try:
        db.delete(audio); db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")
    logger.info("Deleted audio id=%d", audio_id)
    return MessageResponse(message="Audio deleted successfully", detail=f"id={audio_id}")
