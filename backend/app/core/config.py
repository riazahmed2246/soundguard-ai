from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # Application metadata
    PROJECT_NAME: str = "SoundGuard AI"
    VERSION: str = "1.0.0"
    DESCRIPTION: str = "Intelligent Audio Analysis, Forensics & Enhancement System"

    # Database
    DATABASE_URL: str = "sqlite:///./soundguard.db"

    # File storage
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE: int = 52428800  # 50MB in bytes

    # Allowed audio extensions – all common formats
    ALLOWED_EXTENSIONS: List[str] = [
        ".wav", ".mp3", ".flac", ".ogg", ".m4a",
        ".aac", ".wma", ".aiff", ".aif", ".au",
        ".opus", ".mp4", ".webm", ".3gp", ".amr",
        ".caf", ".wv", ".tta", ".ape", ".mpc",
        ".dsf", ".dff",
    ]

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:5173"]

    # AI Model settings
    DEFAULT_SAMPLE_RATE: int = 44100
    DEFAULT_CHUNK_SIZE: int = 1024

    # Enhancement defaults
    DEFAULT_NOISE_REDUCTION: float = 0.8
    DEFAULT_PROCESSING_MODE: str = "balanced"

    # AQI thresholds
    AQI_GOOD_THRESHOLD: float = 70.0
    AQI_FAIR_THRESHOLD: float = 40.0

    # Forensics thresholds
    AUTHENTICITY_AUTHENTIC_THRESHOLD: float = 86.0
    AUTHENTICITY_SUSPICIOUS_THRESHOLD: float = 71.0
    AUTHENTICITY_MODIFIED_THRESHOLD: float = 41.0

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


# Global settings instance
settings = Settings()
