const fs      = require('fs');
const path    = require('path');
const ffprobe = require('@ffprobe-installer/ffprobe');
const ffmpeg  = require('fluent-ffmpeg');
const mongoose = require('mongoose');

const Audio         = require('../models/Audio');
const { UPLOADS_DIR } = require('../middleware/upload');
const {
  callEnhance,
  callExplain,
  callAQI,
  callForensics,
} = require('../services/pythonService');

// Point fluent-ffmpeg at the bundled ffprobe binary
ffmpeg.setFfprobePath(ffprobe.path);

// ─────────────────────────────────────────────────────────────
//  Internal helpers
// ─────────────────────────────────────────────────────────────

/** Promisify ffprobe metadata extraction */
const extractMetadata = (filePath) =>
  new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata);
    });
  });

/** Safely delete a file — never throws */
const safeUnlink = (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    console.warn(`[controller] Could not delete file ${filePath}:`, err.message);
  }
};

/** Broadcast a progress event to all connected WebSocket clients */
const broadcast = (req, payload) => {
  const wss = req.app.get('wss');
  if (!wss) return;
  const msg = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === 1 /* OPEN */) client.send(msg);
  });
};

/** Validate a MongoDB ObjectId and return a 400 early if invalid */
const validateId = (res, id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    res.status(400).json({ success: false, message: 'Invalid audio ID.' });
    return false;
  }
  return true;
};

// ─────────────────────────────────────────────────────────────
//  1. uploadAudio
//     POST /api/upload
//     Multer has already saved the file; here we extract metadata
//     and persist a new Audio document in MongoDB.
// ─────────────────────────────────────────────────────────────
const uploadAudio = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No audio file provided.' });
  }

  const filePath = req.file.path;

  try {
    // Extract audio metadata with ffprobe
    let format   = {};
    let streams  = [];

    try {
      const meta = await extractMetadata(filePath);
      format  = meta.format  || {};
      streams = meta.streams || [];
    } catch (probeErr) {
      console.warn('[uploadAudio] ffprobe failed — saving minimal metadata:', probeErr.message);
    }

    const audioStream = streams.find((s) => s.codec_type === 'audio') || {};
    const ext         = path.extname(req.file.originalname).replace('.', '').toLowerCase();

    // Build and save the Audio document
    const audio = new Audio({
      filename:     req.file.originalname,
      originalPath: filePath,
      format:       ext,
      duration:     parseFloat(format.duration) || null,
      sampleRate:   parseInt(audioStream.sample_rate, 10) || null,
      channels:     audioStream.channels || null,
      fileSize:     req.file.size,
      bitrate:      format.bit_rate ? Math.round(parseInt(format.bit_rate, 10) / 1000) : null,
    });

    await audio.save();

    console.log(`[uploadAudio] ✅  Saved: ${audio._id}  file=${req.file.filename}`);

    return res.status(201).json({
      success: true,
      message: 'File uploaded successfully.',
      data: {
        id:              audio._id,
        filename:        audio.filename,
        format:          audio.format,
        duration:        audio.duration,
        durationFormatted: audio.durationFormatted,
        sampleRate:      audio.sampleRate,
        channels:        audio.channels,
        channelLabel:    audio.channelLabel,
        fileSize:        audio.fileSize,
        fileSizeFormatted: audio.fileSizeFormatted,
        bitrate:         audio.bitrate,
        uploadDate:      audio.uploadDate,
        originalUrl:     `/uploads/${path.basename(filePath)}`,
      },
    });
  } catch (err) {
    // Roll back the uploaded file if DB save fails
    safeUnlink(filePath);
    console.error('[uploadAudio] ❌', err.message);
    return res.status(500).json({ success: false, message: 'Upload processing failed.', error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
//  2. enhanceAudio
//     POST /api/enhance
//     Body: { audioId, model, settings }
// ─────────────────────────────────────────────────────────────
const enhanceAudio = async (req, res) => {
  const { audioId, model = 'CleanUNet', settings = {} } = req.body;

  if (!audioId || !validateId(res, audioId)) return;

  const audio = await Audio.findById(audioId);
  if (!audio) return res.status(404).json({ success: false, message: 'Audio record not found.' });
  if (!audio.originalPath || !fs.existsSync(audio.originalPath)) {
    return res.status(404).json({ success: false, message: 'Original audio file not found on disk.' });
  }

  try {
    broadcast(req, { type: 'progress', module: 'enhance', status: 'processing', audioId });

    const result = await callEnhance(audio.originalPath, model, settings);

    // The Python service returns the path (or URL) of the enhanced file
    const enhancedPath = result.enhancedFilePath || result.enhanced_file_path || null;

    await audio.markEnhanced(enhancedPath, model, result.metrics);

    broadcast(req, { type: 'progress', module: 'enhance', status: 'complete', audioId });

    return res.json({
      success: true,
      message: 'Audio enhanced successfully.',
      data: {
        audioId,
        enhancedUrl:  enhancedPath ? `/uploads/${path.basename(enhancedPath)}` : null,
        model,
        metrics:      result.metrics || {},
        processing:   audio.processing,
      },
    });
  } catch (err) {
    broadcast(req, { type: 'progress', module: 'enhance', status: 'error', audioId, error: err.message });
    console.error('[enhanceAudio] ❌', err.message);
    return res.status(502).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
//  3. explainDenoising
//     POST /api/explain-denoising
//     Body: { audioId }
// ─────────────────────────────────────────────────────────────
const explainDenoising = async (req, res) => {
  const { audioId } = req.body;

  if (!audioId || !validateId(res, audioId)) return;

  const audio = await Audio.findById(audioId);
  if (!audio) return res.status(404).json({ success: false, message: 'Audio record not found.' });
  if (!audio.originalPath || !fs.existsSync(audio.originalPath)) {
    return res.status(404).json({ success: false, message: 'Original audio file not found on disk.' });
  }

  try {
    broadcast(req, { type: 'progress', module: 'explainability', status: 'processing', audioId });

    const enhancedPath = audio.enhancedPath && fs.existsSync(audio.enhancedPath)
      ? audio.enhancedPath
      : null;

    const result = await callExplain(audio.originalPath, enhancedPath);

    await audio.saveExplainability(result);

    broadcast(req, { type: 'progress', module: 'explainability', status: 'complete', audioId });

    return res.json({
      success: true,
      message: 'Explainability analysis complete.',
      data: {
        audioId,
        noiseDetections: result.noiseDetections || [],
        spectrograms:    result.spectrograms    || {},
        report:          result.report          || {},
      },
    });
  } catch (err) {
    broadcast(req, { type: 'progress', module: 'explainability', status: 'error', audioId, error: err.message });
    console.error('[explainDenoising] ❌', err.message);
    return res.status(502).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
//  4. calculateAQI
//     POST /api/calculate-aqi
//     Body: { audioId }
// ─────────────────────────────────────────────────────────────
const calculateAQI = async (req, res) => {
  const { audioId } = req.body;

  if (!audioId || !validateId(res, audioId)) return;

  const audio = await Audio.findById(audioId);
  if (!audio) return res.status(404).json({ success: false, message: 'Audio record not found.' });
  if (!audio.originalPath || !fs.existsSync(audio.originalPath)) {
    return res.status(404).json({ success: false, message: 'Original audio file not found on disk.' });
  }

  try {
    broadcast(req, { type: 'progress', module: 'aqi', status: 'processing', audioId });

    const result = await callAQI(audio.originalPath);

    await audio.saveAQI(result.aqiScore, result);

    broadcast(req, { type: 'progress', module: 'aqi', status: 'complete', audioId });

    return res.json({
      success: true,
      message: 'AQI calculated successfully.',
      data: {
        audioId,
        aqiScore: result.aqiScore,
        aqiBand:  audio.aqiBand,
        metrics:  result.metrics || {},
      },
    });
  } catch (err) {
    broadcast(req, { type: 'progress', module: 'aqi', status: 'error', audioId, error: err.message });
    console.error('[calculateAQI] ❌', err.message);
    return res.status(502).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
//  5. detectTampering
//     POST /api/detect-tampering
//     Body: { audioId }
// ─────────────────────────────────────────────────────────────
const detectTampering = async (req, res) => {
  const { audioId } = req.body;

  if (!audioId || !validateId(res, audioId)) return;

  const audio = await Audio.findById(audioId);
  if (!audio) return res.status(404).json({ success: false, message: 'Audio record not found.' });
  if (!audio.originalPath || !fs.existsSync(audio.originalPath)) {
    return res.status(404).json({ success: false, message: 'Original audio file not found on disk.' });
  }

  try {
    broadcast(req, { type: 'progress', module: 'forensics', status: 'processing', audioId });

    const result = await callForensics(audio.originalPath);

    await audio.saveForensics(
      result.authenticityScore,
      result.tamperingDetected,
      result
    );

    broadcast(req, { type: 'progress', module: 'forensics', status: 'complete', audioId });

    return res.json({
      success: true,
      message: 'Tampering analysis complete.',
      data: {
        audioId,
        authenticityScore: result.authenticityScore,
        tamperingDetected: result.tamperingDetected,
        detections:        result.detections || [],
        summary:           result.summary    || {},
      },
    });
  } catch (err) {
    broadcast(req, { type: 'progress', module: 'forensics', status: 'error', audioId, error: err.message });
    console.error('[detectTampering] ❌', err.message);
    return res.status(502).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
//  6. getAudio
//     GET /api/:id
// ─────────────────────────────────────────────────────────────
const getAudio = async (req, res) => {
  const { id } = req.params;
  if (!validateId(res, id)) return;

  const audio = await Audio.findById(id);
  if (!audio) return res.status(404).json({ success: false, message: 'Audio record not found.' });

  const originalFilename = audio.originalPath ? path.basename(audio.originalPath) : null;
  const enhancedFilename = audio.enhancedPath ? path.basename(audio.enhancedPath) : null;

  return res.json({
    success: true,
    data: {
      id:               audio._id,
      filename:         audio.filename,
      format:           audio.format,
      duration:         audio.duration,
      durationFormatted: audio.durationFormatted,
      sampleRate:       audio.sampleRate,
      channels:         audio.channels,
      channelLabel:     audio.channelLabel,
      fileSize:         audio.fileSize,
      fileSizeFormatted: audio.fileSizeFormatted,
      bitrate:          audio.bitrate,
      uploadDate:       audio.uploadDate,
      originalUrl:      originalFilename ? `/uploads/${originalFilename}` : null,
      enhancedUrl:      enhancedFilename ? `/uploads/${enhancedFilename}` : null,
      processing:       audio.processing,
      aqiBand:          audio.aqiBand,
      results: {
        enhancement:    audio.results.enhancement,
        explainability: audio.results.explainability,
        aqi:            audio.results.aqi,
        forensics:      audio.results.forensics,
      },
    },
  });
};

// ─────────────────────────────────────────────────────────────
//  7. deleteAudio
//     DELETE /api/:id
// ─────────────────────────────────────────────────────────────
const deleteAudio = async (req, res) => {
  const { id } = req.params;
  if (!validateId(res, id)) return;

  const audio = await Audio.findById(id);
  if (!audio) return res.status(404).json({ success: false, message: 'Audio record not found.' });

  // Delete physical files first, then the DB record
  safeUnlink(audio.originalPath);
  safeUnlink(audio.enhancedPath);

  await Audio.findByIdAndDelete(id);

  console.log(`[deleteAudio] ✅  Deleted: ${id}`);

  return res.json({
    success: true,
    message: 'Audio file and record deleted successfully.',
    data: { id },
  });
};

// ─────────────────────────────────────────────────────────────
//  Exports
// ─────────────────────────────────────────────────────────────
module.exports = {
  uploadAudio,
  enhanceAudio,
  explainDenoising,
  calculateAQI,
  detectTampering,
  getAudio,
  deleteAudio,
};