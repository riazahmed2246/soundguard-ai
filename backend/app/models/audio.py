from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, Index
from sqlalchemy.sql import func
from app.core.database import Base
import json
from typing import Optional, Dict, Any


class Audio(Base):
    """
    ORM model representing an uploaded audio file and all derived
    analysis / processing results stored in SoundGuard AI.
    """

    __tablename__ = "audios"

    # ------------------------------------------------------------------
    # Primary key
    # ------------------------------------------------------------------
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)

    # ------------------------------------------------------------------
    # File information
    # ------------------------------------------------------------------
    filename = Column(String(255), nullable=False)
    original_path = Column(String(500), nullable=False)
    enhanced_path = Column(String(500), nullable=True)

    # ------------------------------------------------------------------
    # Audio metadata
    # ------------------------------------------------------------------
    format = Column(String(10), nullable=False)           # e.g. "WAV", "MP3"
    duration = Column(Float, nullable=False)              # seconds
    sample_rate = Column(Integer, nullable=False)         # Hz
    channels = Column(Integer, nullable=False)            # 1 = mono, 2 = stereo
    file_size = Column(Integer, nullable=False)           # bytes
    bitrate = Column(Integer, nullable=True)              # bits/second

    # ------------------------------------------------------------------
    # Timestamps
    # ------------------------------------------------------------------
    upload_date = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    processed_date = Column(DateTime(timezone=True), nullable=True)

    # ------------------------------------------------------------------
    # Processing flags & summary scores
    # ------------------------------------------------------------------
    enhanced = Column(Boolean, default=False, nullable=False)
    enhancement_model = Column(String(50), nullable=True)   # e.g. "cleanunet"
    aqi_score = Column(Float, nullable=True)                # 0-100
    authenticity_score = Column(Float, nullable=True)       # 0-100
    tampering_detected = Column(Boolean, default=False, nullable=False)

    # ------------------------------------------------------------------
    # JSON blobs for full result payloads
    # ------------------------------------------------------------------
    enhancement_results = Column(Text, nullable=True)
    explainability_results = Column(Text, nullable=True)
    aqi_results = Column(Text, nullable=True)
    forensics_results = Column(Text, nullable=True)

    # ------------------------------------------------------------------
    # Composite index to speed up common query patterns
    # ------------------------------------------------------------------
    __table_args__ = (
        Index("ix_audios_upload_date", "upload_date"),
        Index("ix_audios_enhanced", "enhanced"),
        Index("ix_audios_tampering", "tampering_detected"),
    )

    # ------------------------------------------------------------------
    # Representation
    # ------------------------------------------------------------------
    def __repr__(self) -> str:
        return (
            f"<Audio id={self.id} filename={self.filename!r} "
            f"format={self.format} duration={self.duration:.1f}s>"
        )

    # ------------------------------------------------------------------
    # Serialisation helpers
    # ------------------------------------------------------------------
    def to_dict(self) -> Dict[str, Any]:
        """Return a plain dict suitable for JSON serialisation."""
        return {
            "id": self.id,
            "filename": self.filename,
            "original_path": self.original_path,
            "enhanced_path": self.enhanced_path,
            "format": self.format,
            "duration": self.duration,
            "sample_rate": self.sample_rate,
            "channels": self.channels,
            "file_size": self.file_size,
            "bitrate": self.bitrate,
            "upload_date": (
                self.upload_date.isoformat() if self.upload_date else None
            ),
            "processed_date": (
                self.processed_date.isoformat() if self.processed_date else None
            ),
            "enhanced": self.enhanced,
            "enhancement_model": self.enhancement_model,
            "aqi_score": self.aqi_score,
            "authenticity_score": self.authenticity_score,
            "tampering_detected": self.tampering_detected,
        }

    # ------------------------------------------------------------------
    # JSON field accessors
    # ------------------------------------------------------------------
    def _load_json(self, field: Optional[str]) -> Optional[Dict[str, Any]]:
        if field is None:
            return None
        try:
            return json.loads(field)
        except (json.JSONDecodeError, TypeError):
            return None

    @property
    def enhancement_data(self) -> Optional[Dict[str, Any]]:
        return self._load_json(self.enhancement_results)

    @property
    def explainability_data(self) -> Optional[Dict[str, Any]]:
        return self._load_json(self.explainability_results)

    @property
    def aqi_data(self) -> Optional[Dict[str, Any]]:
        return self._load_json(self.aqi_results)

    @property
    def forensics_data(self) -> Optional[Dict[str, Any]]:
        return self._load_json(self.forensics_results)

    # ------------------------------------------------------------------
    # Mutators – keep scores in sync with stored JSON
    # ------------------------------------------------------------------
    def update_enhancement_results(self, data: Dict[str, Any]) -> None:
        """
        Persist enhancement output and mark the record as enhanced.

        Args:
            data: Dict returned by the enhancement service, e.g.::

                {
                    "enhanced_url": "/uploads/enhanced/...",
                    "metrics": { "snr_improvement": 15.3, ... },
                    "processing_time": 3.2,
                    "model": "cleanunet",
                }
        """
        self.enhancement_results = json.dumps(data)
        self.enhanced = True
        self.enhancement_model = data.get("model", self.enhancement_model)

    def update_explainability_results(self, data: Dict[str, Any]) -> None:
        """Persist explainability / noise-detection payload."""
        self.explainability_results = json.dumps(data)

    def update_aqi_results(self, data: Dict[str, Any]) -> None:
        """
        Persist AQI payload and cache the overall score.

        Args:
            data: Dict returned by the AQI service, must contain
                  ``"overall_score"`` (float 0-100).
        """
        self.aqi_results = json.dumps(data)
        self.aqi_score = data.get("overall_score")

    def update_forensics_results(self, data: Dict[str, Any]) -> None:
        """
        Persist forensics payload and update derived flags.

        Args:
            data: Dict returned by the forensics service, must contain
                  ``"authenticity_score"`` (float 0-100).
        """
        self.forensics_results = json.dumps(data)
        score: float = data.get("authenticity_score", 100.0)
        self.authenticity_score = score
        # Scores below 70 indicate tampering (matches API spec thresholds)
        self.tampering_detected = score < 70.0
