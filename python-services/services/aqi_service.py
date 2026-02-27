"""
aqi_service.py
==============
Calculates the Audio Quality Index (AQI) and six sub-metrics using Librosa.

Metrics
-------
1. Signal-to-Noise Ratio (SNR) — estimated from silent/active frame comparison
2. Clarity                     — high-energy spectral frames relative to total
3. Distortion                  — spectral flatness proxy for clipping/distortion
4. Frequency Response          — flatness of the magnitude spectrum across bands
5. Dynamic Range               — difference between peak and noise-floor RMS
6. Noise Floor                 — background noise level in dBFS

AQI Score (0–100) is a weighted average of normalised sub-scores.
"""

import os
import tempfile
import logging
import numpy as np
import librosa
import soundfile as sf
from scipy.signal import welch

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────
#  Weights for the overall AQI composite score
# ─────────────────────────────────────────────────────────────
WEIGHTS = {
    "snr":              0.25,
    "clarity":          0.20,
    "distortion":       0.20,
    "dynamic_range":    0.15,
    "noise_floor":      0.10,
    "frequency_response": 0.10,
}

# ─────────────────────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────────────────────

def _load_audio(file_storage) -> tuple:
    """Save upload to a temp file, load with librosa. Returns (y, sr)."""
    suffix = os.path.splitext(file_storage.filename or "audio.wav")[1] or ".wav"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        file_storage.save(tmp.name)
        tmp_path = tmp.name

    try:
        y, sr = librosa.load(tmp_path, sr=None, mono=True)
    finally:
        os.unlink(tmp_path)

    if len(y) == 0:
        raise ValueError("Audio file is empty or could not be decoded.")
    return y, sr


def _rms_db(signal: np.ndarray) -> float:
    """Root-mean-square level in dBFS."""
    rms = np.sqrt(np.mean(signal ** 2))
    if rms < 1e-10:
        return -120.0
    return float(20 * np.log10(rms))


def _clamp(value: float, lo: float = 0.0, hi: float = 100.0) -> float:
    return max(lo, min(hi, float(value)))


# ─────────────────────────────────────────────────────────────
#  Individual metric calculators
# ─────────────────────────────────────────────────────────────

def _calc_snr(y: np.ndarray, sr: int) -> dict:
    """
    Estimate SNR by comparing RMS of voice-active frames vs silent frames.
    Uses a simple energy-threshold VAD.
    """
    frame_len = int(sr * 0.025)   # 25 ms frames
    hop_len   = int(sr * 0.010)   # 10 ms hop

    rms_frames = librosa.feature.rms(y=y, frame_length=frame_len, hop_length=hop_len)[0]
    if rms_frames.max() < 1e-10:
        return {"value_db": 0.0, "score": 0.0, "label": "0.0 dB"}

    threshold    = rms_frames.max() * 0.10          # 10% of peak = noise gate
    signal_rms   = rms_frames[rms_frames > threshold]
    noise_rms    = rms_frames[rms_frames <= threshold]

    if len(signal_rms) == 0 or len(noise_rms) == 0:
        # Fall back to global estimate
        noise_floor = np.percentile(rms_frames, 10)
        signal_avg  = np.percentile(rms_frames, 90)
    else:
        signal_avg  = float(np.mean(signal_rms))
        noise_floor = float(np.mean(noise_rms))

    if noise_floor < 1e-10:
        snr_db = 60.0
    else:
        snr_db = float(20 * np.log10(signal_avg / noise_floor))

    snr_db = max(0.0, min(60.0, snr_db))
    score  = _clamp((snr_db / 60.0) * 100)

    return {
        "value_db":  round(snr_db, 1),
        "score":     round(score, 1),
        "label":     f"{snr_db:.1f} dB",
        "status":    "Excellent" if score >= 80 else "Good" if score >= 60 else "Fair" if score >= 40 else "Poor",
        "status_ok": score >= 60,
        "raw_value": round(score),
    }


def _calc_clarity(y: np.ndarray, sr: int) -> dict:
    """
    Clarity = fraction of spectrogram frames where energy exceeds the median,
    normalised to a 0–100 percentage.
    """
    S = np.abs(librosa.stft(y, n_fft=2048, hop_length=512))
    frame_energy = S.sum(axis=0)
    median_energy = np.median(frame_energy)
    clarity_ratio = float(np.mean(frame_energy > median_energy))
    clarity_pct   = _clamp(clarity_ratio * 200)   # scale: 0.5 → 100%

    return {
        "value_pct": round(clarity_pct, 1),
        "score":     round(clarity_pct, 1),
        "label":     f"{clarity_pct:.0f}%",
        "status":    "Excellent" if clarity_pct >= 85 else "Good" if clarity_pct >= 70 else "Fair" if clarity_pct >= 50 else "Poor",
        "status_ok": clarity_pct >= 70,
        "raw_value": round(clarity_pct),
    }


def _calc_distortion(y: np.ndarray) -> dict:
    """
    Distortion proxy using spectral flatness.
    High spectral flatness (near 1) → noise-like/clipped signal.
    Low flatness → tonal/clean signal.
    Score is inverted: low distortion = high score.
    """
    flatness = librosa.feature.spectral_flatness(y=y)[0]
    mean_flatness = float(np.mean(flatness))          # 0 (tonal) → 1 (noisy)
    distortion_pct = _clamp(mean_flatness * 100)
    score = _clamp(100 - distortion_pct)              # invert: clean = high score

    return {
        "value_pct": round(distortion_pct, 2),
        "score":     round(score, 1),
        "label":     f"{distortion_pct:.2f}%",
        "status":    "Excellent" if score >= 90 else "Good" if score >= 70 else "Fair" if score >= 50 else "Poor",
        "status_ok": score >= 70,
        "raw_value": round(score),
    }


def _calc_dynamic_range(y: np.ndarray, sr: int) -> dict:
    """
    Dynamic range = peak RMS level − 10th-percentile RMS level (in dB).
    Computed on 100 ms frames.
    """
    frame_len  = int(sr * 0.100)
    hop_len    = int(sr * 0.050)
    rms_frames = librosa.feature.rms(y=y, frame_length=frame_len, hop_length=hop_len)[0]
    rms_frames = rms_frames[rms_frames > 1e-10]

    if len(rms_frames) < 2:
        return {"value_db": 0.0, "score": 50.0, "label": "0 dB", "status": "Fair", "status_ok": True, "raw_value": 50}

    peak_db  = float(20 * np.log10(np.percentile(rms_frames, 99)))
    floor_db = float(20 * np.log10(np.percentile(rms_frames, 10)))
    dr_db    = max(0.0, peak_db - floor_db)

    # 0 dB → score 0, 90+ dB → score 100
    score = _clamp((dr_db / 90.0) * 100)

    return {
        "value_db":  round(dr_db, 1),
        "score":     round(score, 1),
        "label":     f"{dr_db:.0f} dB",
        "status":    "Excellent" if dr_db >= 60 else "Good" if dr_db >= 40 else "Fair" if dr_db >= 20 else "Poor",
        "status_ok": dr_db >= 40,
        "raw_value": round(score),
    }


def _calc_noise_floor(y: np.ndarray, sr: int) -> dict:
    """
    Noise floor = 5th-percentile RMS frame in dBFS.
    Lower is better.  Score: −80 dBFS → 100,  −20 dBFS → 0.
    """
    frame_len  = int(sr * 0.025)
    hop_len    = int(sr * 0.010)
    rms_frames = librosa.feature.rms(y=y, frame_length=frame_len, hop_length=hop_len)[0]
    rms_frames = rms_frames[rms_frames > 1e-12]

    if len(rms_frames) == 0:
        return {"value_db": -80.0, "score": 100.0, "label": "-80 dB", "status": "Excellent", "status_ok": True, "raw_value": 100}

    floor_rms = float(np.percentile(rms_frames, 5))
    floor_db  = float(20 * np.log10(floor_rms)) if floor_rms > 1e-12 else -120.0
    floor_db  = max(-120.0, floor_db)

    # Map −80 dBFS → 100, −20 dBFS → 0  (linear interpolation)
    score = _clamp((floor_db - (-20.0)) / (-80.0 - (-20.0)) * 100)

    return {
        "value_db":  round(floor_db, 1),
        "score":     round(score, 1),
        "label":     f"{floor_db:.0f} dB",
        "status":    "Excellent" if floor_db <= -60 else "Good" if floor_db <= -45 else "Fair" if floor_db <= -30 else "Poor",
        "status_ok": floor_db <= -45,
        "raw_value": round(score),
    }


def _calc_frequency_response(y: np.ndarray, sr: int) -> dict:
    """
    Assess frequency-response flatness by measuring the standard deviation of
    the power spectral density (PSD) across 8 equally-spaced octave bands.
    Low std → flat/good response.  High std → peaked/coloured response.
    """
    freqs, psd = welch(y, fs=sr, nperseg=2048)
    # Avoid DC bin
    freqs = freqs[1:]
    psd   = psd[1:]

    # Compute mean PSD in each of 8 bands between 20 Hz and Nyquist
    lo, hi    = 20.0, sr / 2.0
    band_edges = np.logspace(np.log10(lo), np.log10(hi), 9)
    band_means = []
    for b_lo, b_hi in zip(band_edges[:-1], band_edges[1:]):
        mask = (freqs >= b_lo) & (freqs < b_hi)
        if mask.sum() > 0:
            band_means.append(float(10 * np.log10(np.mean(psd[mask]) + 1e-12)))

    if len(band_means) < 2:
        return {"value": "N/A", "score": 50.0, "label": "N/A", "status": "Fair", "status_ok": True, "raw_value": 50}

    std_db = float(np.std(band_means))
    # std 0 → 100 (perfect flat), std 30+ → 0
    score  = _clamp((1 - std_db / 30.0) * 100)
    label  = "Excellent" if score >= 85 else "Good" if score >= 65 else "Fair" if score >= 45 else "Poor"

    return {
        "value":     label,
        "std_db":    round(std_db, 1),
        "score":     round(score, 1),
        "label":     label,
        "status":    label,
        "status_ok": score >= 65,
        "raw_value": round(score),
    }


# ─────────────────────────────────────────────────────────────
#  Public entry point
# ─────────────────────────────────────────────────────────────

def calculate_aqi(file_storage) -> dict:
    """
    Main entry: load audio, compute all metrics, return structured JSON.

    Parameters
    ----------
    file_storage : werkzeug.datastructures.FileStorage

    Returns
    -------
    dict with keys: aqi_score, aqi_band, metrics
    """
    try:
        y, sr = _load_audio(file_storage)
    except Exception as exc:
        logger.error("Failed to load audio: %s", exc)
        raise

    logger.info("AQI: loaded %d samples @ %d Hz", len(y), sr)

    # ── Compute all six metrics ──────────────────────────
    snr       = _calc_snr(y, sr)
    clarity   = _calc_clarity(y, sr)
    distortion = _calc_distortion(y)
    dyn_range = _calc_dynamic_range(y, sr)
    noise_floor = _calc_noise_floor(y, sr)
    freq_resp = _calc_frequency_response(y, sr)

    # ── Composite AQI score ──────────────────────────────
    raw_scores = {
        "snr":               snr["score"],
        "clarity":           clarity["score"],
        "distortion":        distortion["score"],
        "dynamic_range":     dyn_range["score"],
        "noise_floor":       noise_floor["score"],
        "frequency_response": freq_resp["score"],
    }
    aqi_score = _clamp(
        sum(raw_scores[k] * WEIGHTS[k] for k in WEIGHTS) /
        sum(WEIGHTS.values())
    )
    aqi_score = round(aqi_score)

    band = (
        "Good"  if aqi_score >= 71 else
        "Fair"  if aqi_score >= 41 else
        "Poor"
    )

    return {
        "aqiScore": aqi_score,
        "aqiBand":  band,
        "metrics": {
            "snr": {
                "id":        "snr",
                "name":      "Signal-to-Noise Ratio",
                "value":     snr["label"],
                "rawValue":  snr["raw_value"],
                "status":    snr["status"],
                "statusOk":  snr["status_ok"],
            },
            "clarity": {
                "id":        "clarity",
                "name":      "Clarity",
                "value":     clarity["label"],
                "rawValue":  clarity["raw_value"],
                "status":    clarity["status"],
                "statusOk":  clarity["status_ok"],
            },
            "distortion": {
                "id":        "distortion",
                "name":      "Distortion",
                "value":     distortion["label"],
                "rawValue":  distortion["raw_value"],
                "status":    distortion["status"],
                "statusOk":  distortion["status_ok"],
            },
            "frequency": {
                "id":        "frequency",
                "name":      "Frequency Response",
                "value":     freq_resp["label"],
                "rawValue":  freq_resp["raw_value"],
                "status":    freq_resp["status"],
                "statusOk":  freq_resp["status_ok"],
            },
            "dynamic": {
                "id":        "dynamic",
                "name":      "Dynamic Range",
                "value":     dyn_range["label"],
                "rawValue":  dyn_range["raw_value"],
                "status":    dyn_range["status"],
                "statusOk":  dyn_range["status_ok"],
            },
            "noiseFloor": {
                "id":        "noiseFloor",
                "name":      "Noise Floor",
                "value":     noise_floor["label"],
                "rawValue":  noise_floor["raw_value"],
                "status":    noise_floor["status"],
                "statusOk":  noise_floor["status_ok"],
            },
        },
    }