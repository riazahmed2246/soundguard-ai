from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from app.core.config import settings
from app.core.database import init_db
import os, logging, time

logging.basicConfig(level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s – %(message)s")
logger = logging.getLogger("soundguard")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 SoundGuard AI  v%s", settings.VERSION)
    for d in [settings.UPLOAD_DIR,
              f"{settings.UPLOAD_DIR}/enhanced",
              f"{settings.UPLOAD_DIR}/spectrograms",
              f"{settings.UPLOAD_DIR}/stems",
              f"{settings.UPLOAD_DIR}/edited"]:
        os.makedirs(d, exist_ok=True)
    init_db()
    logger.info("✅ Ready")
    yield
    logger.info("🛑 Shutdown")

app = FastAPI(title=settings.PROJECT_NAME, version=settings.VERSION,
              description=settings.DESCRIPTION, docs_url="/docs",
              redoc_url="/redoc", lifespan=lifespan)

app.add_middleware(CORSMiddleware, allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.middleware("http")
async def timing(request: Request, call_next):
    t = time.perf_counter()
    r = await call_next(request)
    r.headers["X-Process-Time"] = f"{time.perf_counter()-t:.4f}s"
    return r

# Static mounts (most-specific first)
for sub in ["spectrograms", "enhanced", "stems", "edited"]:
    d = f"{settings.UPLOAD_DIR}/{sub}"
    os.makedirs(d, exist_ok=True)
    app.mount(f"/uploads/{sub}", StaticFiles(directory=d), name=sub)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

@app.get("/", tags=["System"])
async def root():
    return {"message": settings.PROJECT_NAME, "version": settings.VERSION,
            "status": "running", "docs": "/docs"}

@app.get("/health", tags=["System"])
async def health():
    return {"status": "healthy", "version": settings.VERSION}

@app.exception_handler(Exception)
async def err(request: Request, exc: Exception):
    logger.exception("Unhandled %s %s", request.method, request.url)
    return JSONResponse(500, {"error": "Internal Server Error",
                              "detail": str(exc), "status_code": 500})

# All routers
from app.api.routes import (audio, enhancement, aqi, forensics,
                             explainability, editor, noise_removal)
app.include_router(audio.router)
app.include_router(enhancement.router)
app.include_router(aqi.router)
app.include_router(forensics.router)
app.include_router(explainability.router)
app.include_router(editor.router)
app.include_router(noise_removal.router)
