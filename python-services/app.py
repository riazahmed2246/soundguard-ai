import sys, os
APP_DIR = os.path.dirname(os.path.abspath(__file__))
if APP_DIR not in sys.path:
    sys.path.insert(0, APP_DIR)
# """
# app.py
# ======
# SoundGuard AI — Python AI Microservices (Flask)
# Runs on port 8000.  Called by the Node.js backend via pythonService.js.

# Endpoints
# ---------
# POST /enhance     → enhancement_service.enhance_audio()
# POST /explain     → explainability_service.explain_denoising()
# POST /aqi         → aqi_service.calculate_aqi()
# POST /forensics   → forensics_service.detect_tampering()
# GET  /health      → liveness check
# """

# import logging
# import traceback
# from flask import Flask, request, jsonify
# from flask_cors import CORS

# # ── Service imports ────────────────────────────────────────────
# from services.enhancement_service   import enhance_audio
# from services.explainability_service import explain_denoising
# from services.aqi_service           import calculate_aqi
# from services.forensics_service     import detect_tampering

# # ─────────────────────────────────────────────────────────────
# #  App setup
# # ─────────────────────────────────────────────────────────────
# app = Flask(__name__)

# logging.basicConfig(
#     level=logging.INFO,
#     format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
#     datefmt="%Y-%m-%d %H:%M:%S",
# )
# logger = logging.getLogger("soundguard")

# # Allow requests from the Node.js backend and the Vite dev server
# CORS(app, resources={r"/*": {"origins": [
#     "http://localhost:5000",   # Express backend
#     "http://localhost:5173",   # Vite dev server
#     "http://localhost:3000",   # fallback
#     "http://localhost:3001",
# ]}})

# # ─────────────────────────────────────────────────────────────
# #  Helpers
# # ─────────────────────────────────────────────────────────────

# def _get_file(field_name: str = "audio"):
#     """Extract an uploaded file from the request; raise 400 if missing."""
#     f = request.files.get(field_name)
#     if f is None:
#         raise ValueError(f"No file uploaded under field '{field_name}'")
#     return f


# def _ok(data: dict):
#     return jsonify({"success": True, **data}), 200


# def _err(message: str, status: int = 400):
#     logger.warning("Error %d: %s", status, message)
#     return jsonify({"success": False, "message": message}), status


# # ─────────────────────────────────────────────────────────────
# #  Health check
# # ─────────────────────────────────────────────────────────────

# @app.get("/health")
# def health():
#     return _ok({"service": "SoundGuard AI Python Microservice", "status": "ok"})


# # ─────────────────────────────────────────────────────────────
# #  POST /enhance
# #  Body (multipart): audio, model, noiseReductionStrength,
# #                    preserveSpeech, processingMode
# # ─────────────────────────────────────────────────────────────

# @app.post("/enhance")
# def route_enhance():
#     try:
#         audio_file = _get_file("audio")
#         model      = request.form.get("model", "CleanUNet")
#         settings   = {
#             "noiseReductionStrength": float(request.form.get("noiseReductionStrength", 80)),
#             "preserveSpeech":         request.form.get("preserveSpeech", "true").lower() == "true",
#             "processingMode":         request.form.get("processingMode", "Balanced"),
#         }
#         logger.info("POST /enhance  model=%s  settings=%s", model, settings)
#         result = enhance_audio(audio_file, model=model, settings=settings)
#         return _ok(result)

#     except ValueError as exc:
#         return _err(str(exc), 400)
#     except Exception:
#         logger.error("Unexpected error in /enhance:\n%s", traceback.format_exc())
#         return _err("Enhancement processing failed.", 500)


# # ─────────────────────────────────────────────────────────────
# #  POST /explain
# #  Body (multipart): original (required), enhanced (optional)
# # ─────────────────────────────────────────────────────────────

# @app.post("/explain")
# def route_explain():
#     try:
#         original_file = _get_file("original")
#         enhanced_file = request.files.get("enhanced")   # optional
#         logger.info("POST /explain  enhanced_present=%s", enhanced_file is not None)
#         result = explain_denoising(original_file, enhanced_file)
#         return _ok(result)

#     except ValueError as exc:
#         return _err(str(exc), 400)
#     except Exception:
#         logger.error("Unexpected error in /explain:\n%s", traceback.format_exc())
#         return _err("Explainability processing failed.", 500)


# # ─────────────────────────────────────────────────────────────
# #  POST /aqi
# #  Body (multipart): audio
# # ─────────────────────────────────────────────────────────────

# @app.post("/aqi")
# def route_aqi():
#     try:
#         audio_file = _get_file("audio")
#         logger.info("POST /aqi  filename=%s", audio_file.filename)
#         result = calculate_aqi(audio_file)
#         return _ok(result)

#     except ValueError as exc:
#         return _err(str(exc), 400)
#     except Exception:
#         logger.error("Unexpected error in /aqi:\n%s", traceback.format_exc())
#         return _err("AQI calculation failed.", 500)


# # ─────────────────────────────────────────────────────────────
# #  POST /forensics
# #  Body (multipart): audio
# # ─────────────────────────────────────────────────────────────

# @app.post("/forensics")
# def route_forensics():
#     try:
#         audio_file = _get_file("audio")
#         logger.info("POST /forensics  filename=%s", audio_file.filename)
#         result = detect_tampering(audio_file)
#         return _ok(result)

#     except ValueError as exc:
#         return _err(str(exc), 400)
#     except Exception:
#         logger.error("Unexpected error in /forensics:\n%s", traceback.format_exc())
#         return _err("Forensic analysis failed.", 500)


# # ─────────────────────────────────────────────────────────────
# #  Global 404 + 405 handlers
# # ─────────────────────────────────────────────────────────────

# @app.errorhandler(404)
# def not_found(_):
#     return _err("Endpoint not found.", 404)


# @app.errorhandler(405)
# def method_not_allowed(_):
#     return _err("Method not allowed.", 405)


# # ─────────────────────────────────────────────────────────────
# #  Entry point
# # ─────────────────────────────────────────────────────────────

# if __name__ == "__main__":
#     import os
#     port  = int(os.environ.get("PORT", 8000))
#     debug = os.environ.get("FLASK_ENV", "production") == "development"
#     logger.info("Starting SoundGuard AI Python service on port %d  debug=%s", port, debug)
#     app.run(host="0.0.0.0", port=port, debug=debug)










"""
app.py
======
SoundGuard AI — Python AI Microservices (Flask)
Runs on port 8000.  Called by the Node.js backend via pythonService.js.
"""

import sys
import os
import logging
import traceback

# ── Fix import path: ensure the directory containing app.py is on sys.path ──
APP_DIR = os.path.dirname(os.path.abspath(__file__))
if APP_DIR not in sys.path:
    sys.path.insert(0, APP_DIR)

from flask import Flask, request, jsonify
from flask_cors import CORS

# ── Service imports ────────────────────────────────────────────
from services.enhancement_service   import enhance_audio
from services.explainability_service import explain_denoising
from services.aqi_service           import calculate_aqi
from services.forensics_service     import detect_tampering

# ─────────────────────────────────────────────────────────────
#  App setup
# ─────────────────────────────────────────────────────────────
app = Flask(__name__)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("soundguard")

CORS(app, resources={r"/*": {"origins": [
    "http://localhost:5000",
    "http://localhost:5173",
    "http://localhost:3000",
]}})

# ─────────────────────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────────────────────

def _get_file(field_name: str = "audio"):
    f = request.files.get(field_name)
    if f is None:
        raise ValueError(f"No file uploaded under field '{field_name}'")
    return f


def _ok(data: dict):
    return jsonify({"success": True, **data}), 200


def _err(message: str, status: int = 400):
    logger.warning("Error %d: %s", status, message)
    return jsonify({"success": False, "message": message}), status


# ─────────────────────────────────────────────────────────────
#  Routes
# ─────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return _ok({"service": "SoundGuard AI Python Microservice", "status": "ok"})


@app.post("/enhance")
def route_enhance():
    try:
        audio_file = _get_file("audio")
        model      = request.form.get("model", "CleanUNet")
        settings   = {
            "noiseReductionStrength": float(request.form.get("noiseReductionStrength", 80)),
            "preserveSpeech":         request.form.get("preserveSpeech", "true").lower() == "true",
            "processingMode":         request.form.get("processingMode", "Balanced"),
        }
        logger.info("POST /enhance  model=%s", model)
        result = enhance_audio(audio_file, model=model, settings=settings)
        return _ok(result)
    except ValueError as exc:
        return _err(str(exc), 400)
    except Exception:
        logger.error("Error in /enhance:\n%s", traceback.format_exc())
        return _err("Enhancement processing failed.", 500)


@app.post("/explain")
def route_explain():
    try:
        original_file = _get_file("original")
        enhanced_file = request.files.get("enhanced")
        logger.info("POST /explain")
        result = explain_denoising(original_file, enhanced_file)
        return _ok(result)
    except ValueError as exc:
        return _err(str(exc), 400)
    except Exception:
        logger.error("Error in /explain:\n%s", traceback.format_exc())
        return _err("Explainability processing failed.", 500)


@app.post("/aqi")
def route_aqi():
    try:
        audio_file = _get_file("audio")
        logger.info("POST /aqi  filename=%s", audio_file.filename)
        result = calculate_aqi(audio_file)
        return _ok(result)
    except ValueError as exc:
        return _err(str(exc), 400)
    except Exception:
        logger.error("Error in /aqi:\n%s", traceback.format_exc())
        return _err("AQI calculation failed.", 500)


@app.post("/forensics")
def route_forensics():
    try:
        audio_file = _get_file("audio")
        logger.info("POST /forensics  filename=%s", audio_file.filename)
        result = detect_tampering(audio_file)
        return _ok(result)
    except ValueError as exc:
        return _err(str(exc), 400)
    except Exception:
        logger.error("Error in /forensics:\n%s", traceback.format_exc())
        return _err("Forensic analysis failed.", 500)


@app.errorhandler(404)
def not_found(_):
    return _err("Endpoint not found.", 404)


@app.errorhandler(405)
def method_not_allowed(_):
    return _err("Method not allowed.", 405)


# ─────────────────────────────────────────────────────────────
#  Entry point
# ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port  = int(os.environ.get("PORT", 8000))
    debug = os.environ.get("FLASK_ENV", "production") == "development"
    logger.info("Starting on port %d  debug=%s", port, debug)
    app.run(host="0.0.0.0", port=port, debug=debug)