# ─────────────────────────────────────────────────────────────
#  SoundGuard AI — Python AI Microservices
#  Base: python:3.9-slim  |  Port: 8000
# ─────────────────────────────────────────────────────────────

FROM python:3.9-slim

# ── System dependencies ────────────────────────────────────────
# libsndfile1  → soundfile / librosa audio I/O
# ffmpeg       → librosa format fallback (mp3, m4a, ogg, flac)
# build-essential / gcc → compile any C extensions in requirements
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    ffmpeg \
    build-essential \
    gcc \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# ── Working directory ──────────────────────────────────────────
WORKDIR /app

# ── Python dependencies ────────────────────────────────────────
# Copy requirements first to maximise Docker layer caching
COPY requirements.txt .

# Install CPU-only torch to keep the image lean (~800 MB vs 4+ GB with CUDA)
# Remove the first two lines if you want the default torch from requirements.txt
RUN pip install --no-cache-dir \
        torch==2.0.0+cpu \
        torchaudio==2.0.0+cpu \
        --extra-index-url https://download.pytorch.org/whl/cpu \
    && pip install --no-cache-dir -r requirements.txt

# ── Copy application code ──────────────────────────────────────
COPY . .

# ── Create uploads directory ───────────────────────────────────
RUN mkdir -p /app/uploads

# ── Runtime environment ────────────────────────────────────────
ENV FLASK_ENV=production \
    PORT=8000 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# ── Expose port ────────────────────────────────────────────────
EXPOSE 8000

# ── Health check ───────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

# ── Start command ──────────────────────────────────────────────
# Use gunicorn in production for multi-worker concurrency.
# Workers = 2 × CPU cores + 1 (capped at 4 for a typical container)
CMD ["gunicorn", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "2", \
     "--timeout", "300", \
     "--log-level", "info", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "app:app"]