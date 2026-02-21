const express = require('express');
const router  = express.Router();

const {
  uploadAudio,
  enhanceAudio,
  explainDenoising,
  calculateAQI,
  detectTampering,
  getAudio,
  deleteAudio,
} = require('../controllers/audioController');

const { uploadSingle } = require('../middleware/upload');

// ─────────────────────────────────────────────────────────────
//  Audio Routes
//  All paths are relative to the /api prefix set in server.js
// ─────────────────────────────────────────────────────────────

// POST  /api/upload            — upload an audio file
router.post('/upload', uploadSingle, uploadAudio);

// POST  /api/enhance           — run AI enhancement on uploaded file
router.post('/enhance', enhanceAudio);

// POST  /api/explain-denoising — explainable noise removal analysis
router.post('/explain-denoising', explainDenoising);

// POST  /api/calculate-aqi     — calculate Audio Quality Index
router.post('/calculate-aqi', calculateAQI);

// POST  /api/detect-tampering  — forensic tampering detection
router.post('/detect-tampering', detectTampering);

// GET   /api/:id               — fetch audio record by MongoDB ID
router.get('/:id', getAudio);

// DELETE /api/:id              — delete audio file + DB record
router.delete('/:id', deleteAudio);

module.exports = router;