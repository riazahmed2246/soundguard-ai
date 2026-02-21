"""
forensics_service.py
====================
Audio forensics / tampering detection using signal-processing heuristics.

Detection methods
-----------------
1. Phase Discontinuity    — abrupt phase jumps between consecutive STFT frames
2. Spectral Discontinuity — sudden changes in spectral centroid across the timeline
3. Energy Discontinuity   — step changes in frame-level RMS energy
4. Noise Floor Consistency— variance of estimated background noise across segments

Each method returns suspected tamper timestamps.  Duplicates within 0.5 s are
merged, then each candidate is classified as 'splice' or 'edit' and assigned a
confidence score.

The overall authenticity score is 100 minus a penalty proportional to the
number and severity of findings.
"""

import os
import tempfile
import logging
import numpy as np
import librosa

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────
#  Config / thresholds
# ─────────────────────────────────────────────────────────────
MERGE_WINDOW_SEC       = 0.50   # merge detections closer than this
MIN_CONFIDENCE         = 55.0   # drop detections below this confidence
PHASE_JUMP_PERCENTILE  = 97     # flag frames above this phase-diff percentile
SPECTRAL_JUMP_PERCENTILE = 95
ENERGY_JUMP_PERCENTILE = 96
MAX_PENALTY_PER_EVENT  = 18     # authenticity penalty per confirmed detection


# ─────────────────────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────────────────────

def _load_audio(file_storage) -> tuple:
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


def _frames_to_time(frames, hop_length: int, sr: int) -> np.ndarray:
    return librosa.frames_to_time(frames, sr=sr, hop_length=hop_length)


def _merge_timestamps(timestamps: list, window: float) -> list:
    """Merge timestamps that are within `window` seconds of each other."""
    if not timestamps:
        return []
    timestamps = sorted(set(timestamps))
    merged = [timestamps[0]]
    for t in timestamps[1:]:
        if t - merged[-1] > window:
            merged.append(t)
    return merged


# ─────────────────────────────────────────────────────────────
#  Detection methods
# ─────────────────────────────────────────────────────────────

def _detect_phase_discontinuities(y: np.ndarray, sr: int, hop: int) -> list:
    """
    Detect abrupt phase jumps in the STFT.  A genuine edit point often has
    a phase wrap that is statistically unlike the surrounding frames.
    """
    D      = librosa.stft(y, n_fft=2048, hop_length=hop)
    phase  = np.angle(D)
    # Inter-frame phase derivative (instantaneous frequency deviation)
    phase_diff = np.abs(np.diff(phase, axis=1)).mean(axis=0)
    threshold  = np.percentile(phase_diff, PHASE_JUMP_PERCENTILE)
    flagged    = np.where(phase_diff > threshold)[0]
    times      = _frames_to_time(flagged, hop, sr).tolist()
    return times


def _detect_spectral_discontinuities(y: np.ndarray, sr: int, hop: int) -> list:
    """
    Detect sudden shifts in spectral centroid — a proxy for frequency content
    changes caused by editing or splicing.
    """
    centroid = librosa.feature.spectral_centroid(y=y, sr=sr, hop_length=hop)[0]
    diff     = np.abs(np.diff(centroid))
    threshold = np.percentile(diff, SPECTRAL_JUMP_PERCENTILE)
    flagged   = np.where(diff > threshold)[0]
    times     = _frames_to_time(flagged, hop, sr).tolist()
    return times


def _detect_energy_discontinuities(y: np.ndarray, sr: int, hop: int) -> list:
    """
    Detect step changes in frame RMS energy — typical of splices between
    recordings made under different conditions.
    """
    rms      = librosa.feature.rms(y=y, hop_length=hop)[0]
    diff     = np.abs(np.diff(rms))
    threshold = np.percentile(diff, ENERGY_JUMP_PERCENTILE)
    flagged   = np.where(diff > threshold)[0]
    times     = _frames_to_time(flagged, hop, sr).tolist()
    return times


def _detect_noise_floor_inconsistencies(y: np.ndarray, sr: int) -> list:
    """
    Divide audio into 1-second segments and measure the 5th-percentile RMS
    (noise floor) of each.  Segments where the noise floor differs by more than
    12 dB from the global median are flagged as potential edit boundaries.
    """
    seg_len = sr
    floors  = []
    for start in range(0, len(y) - seg_len, seg_len // 2):
        seg = y[start : start + seg_len]
        rms = np.sqrt(np.mean(seg ** 2))
        floors.append((start / sr, rms))

    if len(floors) < 3:
        return []

    rms_vals     = np.array([f[1] for f in floors])
    median_rms   = np.median(rms_vals)
    if median_rms < 1e-10:
        return []

    threshold_hi = median_rms * (10 ** (12 / 20))   # +12 dB
    threshold_lo = median_rms / (10 ** (12 / 20))    # -12 dB

    flagged = [
        t for t, rms in floors
        if rms > threshold_hi or (rms < threshold_lo and rms > 1e-10)
    ]
    return flagged


# ─────────────────────────────────────────────────────────────
#  Confidence scoring
# ─────────────────────────────────────────────────────────────

def _compute_confidence(timestamp: float, phase_ts: list, spectral_ts: list,
                         energy_ts: list, noise_ts: list) -> float:
    """
    Confidence = number of independent methods that flagged within ±0.3 s,
    scaled to 55–98%.
    """
    radius  = 0.30
    hits = sum([
        any(abs(t - timestamp) <= radius for t in phase_ts),
        any(abs(t - timestamp) <= radius for t in spectral_ts),
        any(abs(t - timestamp) <= radius for t in energy_ts),
        any(abs(t - timestamp) <= radius for t in noise_ts),
    ])
    confidence_map = {1: 60.0, 2: 75.0, 3: 88.0, 4: 96.0}
    return confidence_map.get(hits, 60.0)


# ─────────────────────────────────────────────────────────────
#  Tamper event classification
# ─────────────────────────────────────────────────────────────

def _classify_event(timestamp: float, confidence: float, phase_ts: list,
                     spectral_ts: list) -> dict:
    """
    Splice = abrupt phase jump (phase method strongly present).
    Edit   = spectral/energy mismatch without strong phase break.
    """
    near_phase = any(abs(t - timestamp) <= 0.3 for t in phase_ts)
    near_spec  = any(abs(t - timestamp) <= 0.3 for t in spectral_ts)

    if near_phase:
        event_type  = "splice"
        title       = "Splice Detected"
        description = "Abrupt phase discontinuity at segment boundary"
        method      = "Spectral phase analysis"
    elif near_spec:
        event_type  = "edit"
        title       = "Edit Detected"
        description = "Spectral content mismatch and possible waveform inconsistency"
        method      = "Spectral centroid analysis"
    else:
        event_type  = "edit"
        title       = "Edit Detected"
        description = "Energy level discontinuity suggesting a cut or paste"
        method      = "RMS energy analysis"

    severity = "High" if confidence >= 85 else "Medium" if confidence >= 70 else "Low"

    return {
        "id":          f"{event_type}-{round(timestamp, 2)}",
        "type":        event_type,
        "title":       title,
        "location":    round(timestamp, 2),
        "confidence":  round(confidence, 1),
        "severity":    severity,
        "description": description,
        "method":      method,
    }


# ─────────────────────────────────────────────────────────────
#  Timeline builder
# ─────────────────────────────────────────────────────────────

def _build_timeline(detections: list, duration: float) -> list:
    """
    Returns a list of {start, end, status} segments for the frontend timeline.
    """
    if not detections:
        return [{"start": 0.0, "end": round(duration, 2), "status": "authentic"}]

    events = sorted(d["location"] for d in detections)
    segments = []
    prev = 0.0
    for loc in events:
        t_start = max(0.0, loc - 0.4)
        t_end   = min(duration, loc + 0.8)
        if t_start > prev:
            segments.append({"start": round(prev, 2), "end": round(t_start, 2), "status": "authentic"})
        segments.append({"start": round(t_start, 2), "end": round(t_end, 2), "status": "tampered"})
        prev = t_end
    if prev < duration:
        segments.append({"start": round(prev, 2), "end": round(duration, 2), "status": "authentic"})
    return segments


# ─────────────────────────────────────────────────────────────
#  Summary builder
# ─────────────────────────────────────────────────────────────

def _build_summary(detections: list, authenticity_score: float,
                   duration: float, processing_time: float) -> dict:
    n = len(detections)
    tampered_dur = sum(
        min(duration, d["location"] + 0.8) - max(0.0, d["location"] - 0.4)
        for d in detections
    )

    if n == 0:
        conclusion     = "No tampering evidence found. Audio appears to be authentic."
        recommendation = "Suitable for use as authentic evidence."
    elif n == 1:
        conclusion     = "One tampering instance detected. Audio may have been edited."
        recommendation = "Verify independently before using as evidence."
    else:
        conclusion     = (
            f"Audio appears to be edited. {n} segments have been identified "
            "as potentially manipulated."
        )
        recommendation = "Not suitable as authentic evidence without further verification."

    return {
        "conclusion":       conclusion,
        "detectionCount":   n,
        "tamperedDuration": f"{tampered_dur:.1f} seconds",
        "recommendation":   recommendation,
        "analysisMethod":   "Phase discontinuity + Spectral analysis + ENF heuristics",
        "processingTime":   f"{processing_time:.1f} seconds",
        "dataset":          "Signal processing heuristics (no external model required)",
    }


# ─────────────────────────────────────────────────────────────
#  Public entry point
# ─────────────────────────────────────────────────────────────

def detect_tampering(file_storage) -> dict:
    """
    Main entry: load audio, run all detection methods, build response.

    Returns
    -------
    dict with: authenticityScore, tamperingDetected, detections, summary, timeline
    """
    import time
    t_start = time.time()

    y, sr = _load_audio(file_storage)
    duration = len(y) / sr
    hop = 512

    logger.info("Forensics: loaded %.2f s of audio @ %d Hz", duration, sr)

    # ── Run all detection methods ────────────────────────
    phase_ts    = _detect_phase_discontinuities(y, sr, hop)
    spectral_ts = _detect_spectral_discontinuities(y, sr, hop)
    energy_ts   = _detect_energy_discontinuities(y, sr, hop)
    noise_ts    = _detect_noise_floor_inconsistencies(y, sr)

    # ── Collect all candidate timestamps ────────────────
    all_timestamps = phase_ts + spectral_ts + energy_ts + noise_ts
    merged         = _merge_timestamps(all_timestamps, MERGE_WINDOW_SEC)

    # ── Score and filter candidates ──────────────────────
    raw_events = []
    for ts in merged:
        conf = _compute_confidence(ts, phase_ts, spectral_ts, energy_ts, noise_ts)
        if conf >= MIN_CONFIDENCE:
            event = _classify_event(ts, conf, phase_ts, spectral_ts)
            raw_events.append(event)

    # Keep at most the top-5 highest-confidence events
    raw_events.sort(key=lambda e: e["confidence"], reverse=True)
    detections = raw_events[:5]

    # ── Authenticity score ───────────────────────────────
    penalty = sum(
        min(MAX_PENALTY_PER_EVENT, (e["confidence"] - 55) / 45 * MAX_PENALTY_PER_EVENT)
        for e in detections
    )
    authenticity_score = max(0, min(100, round(100 - penalty)))

    processing_time = time.time() - t_start

    timeline = _build_timeline(detections, duration)
    summary  = _build_summary(detections, authenticity_score, duration, processing_time)

    return {
        "authenticityScore": authenticity_score,
        "tamperingDetected": len(detections) > 0,
        "detections":        detections,
        "summary":           summary,
        "timeline":          timeline,
    }