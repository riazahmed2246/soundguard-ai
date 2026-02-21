const axios = require('axios');
const fs    = require('fs');
const path  = require('path');
const FormData = require('form-data');  // node built-in via axios peer

// ─────────────────────────────────────────────────────────────
//  Axios instance pointed at the Python Flask microservice
// ─────────────────────────────────────────────────────────────
const PYTHON_BASE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

const pythonClient = axios.create({
  baseURL: PYTHON_BASE_URL,
  timeout: 5 * 60 * 1000,   // 5 minutes — AI models can take time
  headers: { Accept: 'application/json' },
});

// ─────────────────────────────────────────────────────────────
//  Internal helper — build a FormData with an audio file stream
// ─────────────────────────────────────────────────────────────
const buildAudioForm = (audioPath, extraFields = {}) => {
  const form = new FormData();
  form.append('audio', fs.createReadStream(audioPath), {
    filename:    path.basename(audioPath),
    contentType: 'audio/*',
  });
  Object.entries(extraFields).forEach(([key, value]) => {
    form.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
  });
  return form;
};

// ─────────────────────────────────────────────────────────────
//  Internal helper — uniform error handling for Python calls
// ─────────────────────────────────────────────────────────────
const handlePythonError = (err, endpoint) => {
  if (err.code === 'ECONNREFUSED') {
    const msg = `Python service is not reachable at ${PYTHON_BASE_URL}${endpoint}. Is it running?`;
    console.error(`[pythonService] ${msg}`);
    throw new Error(msg);
  }

  if (err.response) {
    // Python returned an HTTP error (4xx / 5xx)
    const msg =
      err.response.data?.message ||
      err.response.data?.error   ||
      `Python service error ${err.response.status} on ${endpoint}`;
    console.error(`[pythonService] ${msg}`, err.response.data);
    throw new Error(msg);
  }

  if (err.code === 'ECONNABORTED') {
    throw new Error(`Python service timed out on ${endpoint}. Try a shorter audio file.`);
  }

  console.error(`[pythonService] Unexpected error on ${endpoint}:`, err.message);
  throw err;
};

// ─────────────────────────────────────────────────────────────
//  1.  callEnhance
//      POST /enhance
//      Sends the audio file + model settings to the enhancement service.
//      Returns: { enhancedAudioPath, metrics: { noiseReduced, snrImprovement,
//                 speechClarity, processingTime } }
// ─────────────────────────────────────────────────────────────
const callEnhance = async (audioPath, model = 'CleanUNet', settings = {}) => {
  const endpoint = '/enhance';
  try {
    const form = buildAudioForm(audioPath, {
      model,
      noiseReductionStrength: settings.noiseReductionStrength ?? 80,
      preserveSpeech:         settings.preserveSpeech         ?? true,
      processingMode:         settings.processingMode         ?? 'Balanced',
    });

    const response = await pythonClient.post(endpoint, form, {
      headers:      form.getHeaders(),
      responseType: 'json',
      timeout:      10 * 60 * 1000,   // enhancement can be slow
    });

    console.log(`[pythonService] callEnhance ✅  model=${model}`);
    return response.data;
  } catch (err) {
    handlePythonError(err, endpoint);
  }
};

// ─────────────────────────────────────────────────────────────
//  2.  callExplain
//      POST /explain
//      Sends both original and enhanced audio for GradCAM / spectrogram analysis.
//      Returns: { noiseDetections: [...], spectrograms: { original, enhanced },
//                 report: { ... } }
// ─────────────────────────────────────────────────────────────
const callExplain = async (originalPath, enhancedPath = null) => {
  const endpoint = '/explain';
  try {
    const form = new FormData();

    form.append('original', fs.createReadStream(originalPath), {
      filename:    path.basename(originalPath),
      contentType: 'audio/*',
    });

    if (enhancedPath && fs.existsSync(enhancedPath)) {
      form.append('enhanced', fs.createReadStream(enhancedPath), {
        filename:    path.basename(enhancedPath),
        contentType: 'audio/*',
      });
    }

    const response = await pythonClient.post(endpoint, form, {
      headers: form.getHeaders(),
    });

    console.log(`[pythonService] callExplain ✅  detections=${response.data?.noiseDetections?.length ?? 0}`);
    return response.data;
  } catch (err) {
    handlePythonError(err, endpoint);
  }
};

// ─────────────────────────────────────────────────────────────
//  3.  callAQI
//      POST /aqi
//      Calculates Audio Quality Index and 6 sub-metrics via Librosa / DNSMOS.
//      Returns: { aqiScore: 87, metrics: { snr, clarity, distortion,
//                 frequencyResponse, dynamicRange, noiseFloor } }
// ─────────────────────────────────────────────────────────────
const callAQI = async (audioPath) => {
  const endpoint = '/aqi';
  try {
    const form = buildAudioForm(audioPath);

    const response = await pythonClient.post(endpoint, form, {
      headers: form.getHeaders(),
    });

    console.log(`[pythonService] callAQI ✅  score=${response.data?.aqiScore}`);
    return response.data;
  } catch (err) {
    handlePythonError(err, endpoint);
  }
};

// ─────────────────────────────────────────────────────────────
//  4.  callForensics
//      POST /forensics
//      Runs RawNet3 deepfake / splice detection + ENF analysis.
//      Returns: { authenticityScore: 56, tamperingDetected: true,
//                 detections: [...], summary: { ... } }
// ─────────────────────────────────────────────────────────────
const callForensics = async (audioPath) => {
  const endpoint = '/forensics';
  try {
    const form = buildAudioForm(audioPath);

    const response = await pythonClient.post(endpoint, form, {
      headers: form.getHeaders(),
    });

    console.log(
      `[pythonService] callForensics ✅  authentic=${response.data?.authenticityScore}  ` +
      `tampered=${response.data?.tamperingDetected}`
    );
    return response.data;
  } catch (err) {
    handlePythonError(err, endpoint);
  }
};

// ─────────────────────────────────────────────────────────────
//  Health check — called by server startup or a /health route
// ─────────────────────────────────────────────────────────────
const checkPythonHealth = async () => {
  try {
    const res = await pythonClient.get('/health', { timeout: 5000 });
    return { reachable: true, status: res.data };
  } catch {
    return { reachable: false, status: null };
  }
};

module.exports = {
  callEnhance,
  callExplain,
  callAQI,
  callForensics,
  checkPythonHealth,
};