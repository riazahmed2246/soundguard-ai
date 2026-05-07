from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------

class EnhancementModel(str, Enum):
    """Supported AI enhancement models."""
    DEMUCS = "demucs"
    CLEANUNET = "cleanunet"
    FULLSUBNET = "fullsubnet"


class ProcessingMode(str, Enum):
    """Processing speed / quality trade-off."""
    FAST = "fast"
    BALANCED = "balanced"
    QUALITY = "quality"


class AQIStatus(str, Enum):
    """Human-readable audio quality tier."""
    GOOD = "Good"
    FAIR = "Fair"
    POOR = "Poor"


class AuthenticityStatus(str, Enum):
    """Forensic authenticity classification."""
    AUTHENTIC = "authentic"
    SUSPICIOUS = "suspicious"
    MODIFIED = "modified"
    SEVERELY_MODIFIED = "severely_modified"


class DetectionType(str, Enum):
    """Types of detected tampering events."""
    SPLICE = "splice"
    EDIT = "edit"
    DEEPFAKE = "deepfake"
    NOISE_INJECTION = "noise_injection"
    PITCH_SHIFT = "pitch_shift"


class Severity(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


# ---------------------------------------------------------------------------
# Audio – base / create / response
# ---------------------------------------------------------------------------

class AudioBase(BaseModel):
    """Fields shared between creation and read schemas."""
    filename: str = Field(..., min_length=1, max_length=255)
    format: str = Field(..., min_length=1, max_length=10)
    duration: float = Field(..., gt=0, description="Duration in seconds")
    sample_rate: int = Field(..., gt=0, description="Sample rate in Hz")
    channels: int = Field(..., ge=1, le=8, description="Number of audio channels")
    file_size: int = Field(..., gt=0, description="File size in bytes")
    bitrate: Optional[int] = Field(None, gt=0, description="Bitrate in bits/s")


class AudioCreate(AudioBase):
    """Schema used internally when inserting a new audio record."""
    original_path: str = Field(..., min_length=1, max_length=500)


class AudioResponse(AudioBase):
    """Schema returned to the client after upload or GET requests."""
    id: int
    upload_date: datetime
    enhanced: bool
    enhancement_model: Optional[str] = None
    aqi_score: Optional[float] = Field(None, ge=0, le=100)
    authenticity_score: Optional[float] = Field(None, ge=0, le=100)
    tampering_detected: bool

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Enhancement
# ---------------------------------------------------------------------------

class EnhancementRequest(BaseModel):
    """Request body for POST /api/enhance."""
    audio_id: int = Field(..., gt=0)
    model: EnhancementModel = EnhancementModel.CLEANUNET
    noise_reduction: float = Field(
        default=0.8,
        ge=0.0,
        le=1.0,
        description="Noise reduction strength (0 = none, 1 = maximum)",
    )
    preserve_speech: bool = Field(
        default=True,
        description="Prioritise speech intelligibility during enhancement",
    )
    mode: ProcessingMode = ProcessingMode.BALANCED


class EnhancementMetrics(BaseModel):
    """Quantitative output of the enhancement process."""
    noise_reduced: float = Field(..., description="Percentage of noise removed")
    snr_improvement: float = Field(..., description="SNR improvement in dB")
    clarity_improvement: float = Field(..., description="Clarity improvement %")
    processing_time: float = Field(..., description="Wall-clock time in seconds")


class EnhancementResponse(BaseModel):
    """Response body for POST /api/enhance."""
    audio_id: int
    enhanced_url: str
    metrics: EnhancementMetrics
    processing_time: float


# ---------------------------------------------------------------------------
# Explainability
# ---------------------------------------------------------------------------

class NoiseSegment(BaseModel):
    """A localised noise event identified by the explainability service."""
    start_time: float = Field(..., ge=0, description="Start of segment in seconds")
    end_time: float = Field(..., ge=0, description="End of segment in seconds")
    noise_type: str
    frequency_range: str = Field(..., description="e.g. '200–4000 Hz'")
    confidence: float = Field(..., ge=0, le=1)
    severity: Severity

    @model_validator(mode="after")
    def end_after_start(self):
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be greater than start_time")
        return self


class ExplainabilityResponse(BaseModel):
    """Response body for POST /api/explainability/analyze."""
    audio_id: int
    noise_segments: List[NoiseSegment]
    dominant_noise_type: str
    overall_noise_level: str        # e.g. "Moderate"
    spectrogram_before_url: Optional[str] = None
    spectrogram_after_url: Optional[str] = None
    report_url: Optional[str] = None


# ---------------------------------------------------------------------------
# AQI (Audio Quality Index)
# ---------------------------------------------------------------------------

class AQIRequest(BaseModel):
    """Request body for POST /api/aqi/calculate."""
    audio_id: int = Field(..., gt=0)


class AQIMetrics(BaseModel):
    """Six detailed quality dimensions."""
    snr: float = Field(..., description="Signal-to-Noise Ratio in dB")
    clarity: float = Field(..., ge=0, le=100, description="Clarity percentage")
    distortion: float = Field(..., ge=0, le=100, description="Distortion percentage")
    frequency_response: str = Field(
        ..., description="Qualitative frequency response assessment"
    )
    dynamic_range: float = Field(..., description="Dynamic range in dB")
    noise_floor: float = Field(..., description="Noise floor in dBFS (negative)")


class AQIResponse(BaseModel):
    """Response body for POST /api/aqi/calculate."""
    audio_id: int
    overall_score: float = Field(..., ge=0, le=100)
    status: AQIStatus
    metrics: AQIMetrics

    @field_validator("status", mode="before")
    @classmethod
    def derive_status(cls, v, info):
        """Auto-derive status from overall_score if not provided."""
        if isinstance(v, str) and v in AQIStatus._value2member_map_:
            return v
        score = info.data.get("overall_score", 0)
        if score >= 70:
            return AQIStatus.GOOD
        if score >= 40:
            return AQIStatus.FAIR
        return AQIStatus.POOR


# ---------------------------------------------------------------------------
# Forensics / Tampering Detection
# ---------------------------------------------------------------------------

class ForensicsRequest(BaseModel):
    """Request body for POST /api/forensics/detect."""
    audio_id: int = Field(..., gt=0)


class Detection(BaseModel):
    """A single tampering event found in the audio."""
    type: DetectionType
    timestamp: float = Field(..., ge=0, description="Event position in seconds")
    confidence: float = Field(..., ge=0, le=1)
    severity: Severity
    description: str = Field(..., min_length=1)


class ForensicsResponse(BaseModel):
    """Response body for POST /api/forensics/detect."""
    audio_id: int
    authenticity_score: float = Field(..., ge=0, le=100)
    status: AuthenticityStatus
    detections: List[Detection]
    summary: str
    report_url: Optional[str] = None

    @field_validator("status", mode="before")
    @classmethod
    def derive_status(cls, v, info):
        """Auto-derive authenticity status from score when not provided."""
        if isinstance(v, str) and v in AuthenticityStatus._value2member_map_:
            return v
        score = info.data.get("authenticity_score", 0)
        if score >= 86:
            return AuthenticityStatus.AUTHENTIC
        if score >= 71:
            return AuthenticityStatus.SUSPICIOUS
        if score >= 41:
            return AuthenticityStatus.MODIFIED
        return AuthenticityStatus.SEVERELY_MODIFIED


# ---------------------------------------------------------------------------
# Generic / utility schemas
# ---------------------------------------------------------------------------

class MessageResponse(BaseModel):
    """Simple message envelope for DELETE / confirmation responses."""
    message: str
    detail: Optional[str] = None


class ErrorResponse(BaseModel):
    """Standard error body."""
    error: str
    detail: Optional[str] = None
    status_code: int


class PaginatedAudioResponse(BaseModel):
    """Paginated list of audio records."""
    items: List[AudioResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class ProcessingStatus(BaseModel):
    """Polling response for long-running background tasks."""
    task_id: str
    status: str             # "pending" | "processing" | "completed" | "failed"
    progress: float = Field(default=0.0, ge=0, le=100)
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
