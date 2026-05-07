# 🔊 SoundGuard AI

Intelligent Audio Analysis, Forensics & Enhancement System — full-stack application with a FastAPI backend and React + Vite frontend.

---

## Quick Start

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs → http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
cp .env.example .env              # optional – defaults to localhost:8000
npm ruen dv
```

App → http://localhost:5173
Backend → http://localhost:8000

---

## Features

| Module | Description |
|--------|-------------|
| **Enhancement** | AI noise reduction (CleanUNet / DEMUCS / FullSubNet+) |
| **AQI** | 6-metric Audio Quality Index (SNR, Clarity, Distortion, …) |
| **Forensics** | Splice & edit detection, authenticity scoring |
| **Explainability** | Spectrogram visualisation + noise-pattern cards |

---

## Project Structure

```
soundguard-ai/
├── backend/
│   ├── app/
│   │   ├── api/routes/          # FastAPI routers
│   │   ├── core/                # Config + DB
│   │   ├── models/              # SQLAlchemy ORM
│   │   ├── schemas/             # Pydantic schemas
│   │   ├── services/            # Business logic / AI
│   │   └── main.py
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── Editor/
    │   │   ├── Layout/
    │   │   ├── Modules/
    │   │   └── Upload/
    │   ├── context/AudioContext.jsx
    │   ├── services/api.js
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── index.css
    ├── package.json
    └── vite.config.js
```

---

## Authors

- **Mahmudul Ferdous** — 2020331037
- **Riaz Ahmed** — 2020331079

**Supervisor:** Dr. Husne Ara Chowdhury, CSE Dept, SUST
