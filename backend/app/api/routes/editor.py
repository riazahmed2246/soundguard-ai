"""
Audio Editor Route — manual cut/trim/fade/gain/export
"""
import os, json, logging, tempfile
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional, List
import librosa, soundfile as sf, numpy as np
from scipy.signal import butter, sosfiltfilt

from app.core.database import get_db
from app.core.config import settings
from app.models.audio import Audio

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/editor", tags=["editor"])

EXPORT_FORMATS = {"wav": "audio/wav", "flac": "audio/flac",
                  "ogg": "audio/ogg", "mp3": "audio/mpeg",
                  "aac": "audio/aac",  "m4a": "audio/mp4"}


class TrimRequest(BaseModel):
    audio_id: int
    start_time: float = Field(..., ge=0, description="Start in seconds")
    end_time:   float = Field(..., gt=0, description="End in seconds")
    output_format: str = Field(default="wav")

class FadeRequest(BaseModel):
    audio_id: int
    fade_in:  float = Field(default=0.0, ge=0, description="Fade-in duration (s)")
    fade_out: float = Field(default=0.0, ge=0, description="Fade-out duration (s)")
    output_format: str = Field(default="wav")

class GainRequest(BaseModel):
    audio_id:  int
    gain_db:   float = Field(..., ge=-40, le=40, description="Gain in dB")
    normalize: bool  = Field(default=False)
    output_format: str = Field(default="wav")

class SilenceRemoveRequest(BaseModel):
    audio_id:          int
    threshold_db:      float = Field(default=-40.0)
    min_silence_ms:    int   = Field(default=200)
    output_format: str = Field(default="wav")

class ConcatRequest(BaseModel):
    audio_ids:     List[int]
    crossfade_ms:  int   = Field(default=0, ge=0, le=2000)
    output_format: str   = Field(default="wav")


def _get_audio_or_404(audio_id: int, db: Session) -> Audio:
    a = db.query(Audio).filter(Audio.id == audio_id).first()
    if not a:
        raise HTTPException(404, f"Audio {audio_id} not found")
    return a

def _require_file(path):
    if not path or not os.path.exists(path):
        raise HTTPException(404, "Audio file not found on disk")

def _write_output(audio: np.ndarray, sr: int, fmt: str, prefix: str) -> str:
    fmt = fmt.lower().strip(".")
    out_dir = os.path.join(settings.UPLOAD_DIR, "edited")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, f"{prefix}.{fmt}")

    if fmt == "wav":
        sf.write(out_path, audio, sr, subtype="PCM_16")
    else:
        try:
            import torchaudio, torch
            t = torch.from_numpy(audio.T if audio.ndim == 2 else audio.reshape(1, -1)).float()
            torchaudio.save(out_path, t, sr)
        except Exception:
            wav_tmp = out_path.replace(f".{fmt}", "_tmp.wav")
            sf.write(wav_tmp, audio, sr)
            out_path = wav_tmp
    return out_path

def _serve(path: str, fmt: str, name: str):
    mime = EXPORT_FORMATS.get(fmt.lower(), "audio/wav")
    return FileResponse(path, media_type=mime, filename=name)


@router.post("/trim", summary="Trim audio to start–end window")
async def trim_audio(req: TrimRequest, db: Session = Depends(get_db)):
    audio_rec = _get_audio_or_404(req.audio_id, db)
    src = audio_rec.enhanced_path or audio_rec.original_path
    _require_file(src)

    audio, sr = librosa.load(src, sr=None, mono=False)
    mono = audio[0] if audio.ndim == 2 else audio
    dur = len(mono) / sr

    start = max(0.0, req.start_time)
    end   = min(dur,  req.end_time)
    if end <= start:
        raise HTTPException(400, "end_time must be greater than start_time")

    s, e = int(start * sr), int(end * sr)
    trimmed = audio[:, s:e] if audio.ndim == 2 else audio[s:e]

    out = _write_output(trimmed, sr, req.output_format, f"trim_{req.audio_id}_{int(start*1000)}")
    return _serve(out, req.output_format, f"trim_{audio_rec.filename}.{req.output_format}")


@router.post("/fade", summary="Apply fade-in and/or fade-out")
async def apply_fade(req: FadeRequest, db: Session = Depends(get_db)):
    audio_rec = _get_audio_or_404(req.audio_id, db)
    src = audio_rec.enhanced_path or audio_rec.original_path
    _require_file(src)

    audio, sr = librosa.load(src, sr=None, mono=False)
    result = audio.copy()
    n = result.shape[-1]

    fi = min(int(req.fade_in  * sr), n // 2)
    fo = min(int(req.fade_out * sr), n // 2)

    if fi > 0:
        envelope = np.linspace(0.0, 1.0, fi) ** 2   # quadratic
        if result.ndim == 2: result[:, :fi] *= envelope
        else:                result[:fi]    *= envelope

    if fo > 0:
        envelope = np.linspace(1.0, 0.0, fo) ** 2
        if result.ndim == 2: result[:, -fo:] *= envelope
        else:                result[-fo:]    *= envelope

    out = _write_output(result, sr, req.output_format, f"fade_{req.audio_id}")
    return _serve(out, req.output_format, f"fade_{audio_rec.filename}.{req.output_format}")


@router.post("/gain", summary="Apply gain adjustment or normalize")
async def apply_gain(req: GainRequest, db: Session = Depends(get_db)):
    audio_rec = _get_audio_or_404(req.audio_id, db)
    src = audio_rec.enhanced_path or audio_rec.original_path
    _require_file(src)

    audio, sr = librosa.load(src, sr=None, mono=False)
    result = audio.astype(np.float32)

    if req.normalize:
        peak = float(np.max(np.abs(result))) + 1e-12
        result = result * (0.891 / peak)   # -1 dBFS
    else:
        factor = 10.0 ** (req.gain_db / 20.0)
        result = np.clip(result * factor, -1.0, 1.0)

    out = _write_output(result, sr, req.output_format, f"gain_{req.audio_id}")
    return _serve(out, req.output_format, f"gain_{audio_rec.filename}.{req.output_format}")


@router.post("/remove-silence", summary="Remove silent sections")
async def remove_silence(req: SilenceRemoveRequest, db: Session = Depends(get_db)):
    audio_rec = _get_audio_or_404(req.audio_id, db)
    src = audio_rec.enhanced_path or audio_rec.original_path
    _require_file(src)

    audio, sr = librosa.load(src, sr=None, mono=True)

    intervals = librosa.effects.split(
        audio,
        top_db=abs(req.threshold_db),
        frame_length=int(req.min_silence_ms * sr / 1000),
        hop_length=int(req.min_silence_ms * sr / 4000),
    )
    if len(intervals) == 0:
        raise HTTPException(400, "No non-silent sections found at this threshold")

    parts = [audio[s:e] for s, e in intervals]
    result = np.concatenate(parts)

    out = _write_output(result, sr, req.output_format, f"silent_{req.audio_id}")
    return _serve(out, req.output_format, f"nosil_{audio_rec.filename}.{req.output_format}")


@router.post("/concat", summary="Concatenate multiple audio files")
async def concat_audio(req: ConcatRequest, db: Session = Depends(get_db)):
    if len(req.audio_ids) < 2:
        raise HTTPException(400, "Need at least 2 audio IDs")

    parts = []
    target_sr = None
    for aid in req.audio_ids:
        a = _get_audio_or_404(aid, db)
        src = a.enhanced_path or a.original_path
        _require_file(src)
        audio, sr = librosa.load(src, sr=target_sr, mono=True)
        if target_sr is None: target_sr = sr
        parts.append(audio)

    if req.crossfade_ms > 0 and len(parts) > 1:
        cf = int(req.crossfade_ms * target_sr / 1000)
        merged = parts[0]
        for nxt in parts[1:]:
            fade_out = np.linspace(1, 0, min(cf, len(merged), len(nxt)))
            fade_in  = np.linspace(0, 1, len(fade_out))
            merged[-len(fade_out):] *= fade_out
            nxt[:len(fade_in)]      *= fade_in
            merged = np.concatenate([merged, nxt])
        result = merged
    else:
        result = np.concatenate(parts)

    out = _write_output(result, target_sr, req.output_format,
                        f"concat_{'_'.join(str(i) for i in req.audio_ids)}")
    return _serve(out, req.output_format, f"concat.{req.output_format}")


@router.get("/waveform/{audio_id}", summary="Get waveform peak data for timeline display")
async def get_waveform_data(
    audio_id: int,
    resolution: int = Query(default=1000, ge=100, le=5000),
    db: Session = Depends(get_db),
):
    """Returns downsampled peak/RMS arrays suitable for waveform rendering."""
    audio_rec = _get_audio_or_404(audio_id, db)
    src = audio_rec.enhanced_path or audio_rec.original_path
    _require_file(src)

    audio, sr = librosa.load(src, sr=None, mono=True)
    hop = max(1, len(audio) // resolution)

    peaks = [float(np.max(np.abs(audio[i:i+hop])))
             for i in range(0, len(audio), hop)]
    rms   = [float(np.sqrt(np.mean(audio[i:i+hop]**2)))
             for i in range(0, len(audio), hop)]

    return {
        "audio_id":   audio_id,
        "duration":   float(len(audio) / sr),
        "sample_rate": sr,
        "peaks":       peaks[:resolution],
        "rms":         rms[:resolution],
    }
