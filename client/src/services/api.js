import axios from 'axios';

// ─────────────────────────────────────────────────────────────
//  Axios instance
//  baseURL points at the Express backend.
//  In development Vite proxies /api → http://localhost:5000/api
//  so either the full URL or a relative '/api' path works.
// ─────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  timeout: 10 * 60 * 1000,   // 10 minutes — AI processing can be slow
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false,
});

// ─────────────────────────────────────────────────────────────
//  Request interceptor — log outgoing calls in development
// ─────────────────────────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    if (import.meta.env.DEV) {
      console.log(`[api] ➡  ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─────────────────────────────────────────────────────────────
//  Response interceptor — normalise errors into a single shape:
//  { message: string, status: number, data: any }
// ─────────────────────────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status  = error.response?.status  ?? 0;
    const message =
      error.response?.data?.message ||
      error.response?.data?.error   ||
      error.message                 ||
      'An unexpected error occurred.';

    if (import.meta.env.DEV) {
      console.error(`[api] ❌  ${status} ${message}`, error.response?.data);
    }

    const normalised = new Error(message);
    normalised.status = status;
    normalised.data   = error.response?.data ?? null;
    return Promise.reject(normalised);
  }
);

// ─────────────────────────────────────────────────────────────
//  1. uploadAudio
//     POST /api/upload
//     @param {FormData} formData  — must contain key "audio" with the File
//     @param {Function} onProgress — optional (percent: number) => void
//     @returns {Promise<{ id, filename, format, duration, ... }>}
// ─────────────────────────────────────────────────────────────
export const uploadAudio = (formData, onProgress) => {
  return api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onProgress
      ? (e) => {
          if (e.total) {
            const percent = Math.round((e.loaded * 100) / e.total);
            onProgress(percent);
          }
        }
      : undefined,
  }).then((res) => res.data.data);
};

// ─────────────────────────────────────────────────────────────
//  2. enhanceAudio
//     POST /api/enhance
//     @param {string} audioId
//     @param {string} model      — 'DEMUCS' | 'CleanUNet' | 'FullSubNet+'
//     @param {object} settings   — { noiseReductionStrength, preserveSpeech, processingMode }
//     @returns {Promise<{ audioId, enhancedUrl, model, metrics, processing }>}
// ─────────────────────────────────────────────────────────────
export const enhanceAudio = (audioId, model = 'CleanUNet', settings = {}) => {
  return api.post('/enhance', { audioId, model, settings })
    .then((res) => res.data.data);
};

// ─────────────────────────────────────────────────────────────
//  3. explainDenoising
//     POST /api/explain-denoising
//     @param {string} audioId
//     @returns {Promise<{ audioId, noiseDetections, spectrograms, report }>}
// ─────────────────────────────────────────────────────────────
export const explainDenoising = (audioId) => {
  return api.post('/explain-denoising', { audioId })
    .then((res) => res.data.data);
};

// ─────────────────────────────────────────────────────────────
//  4. calculateAQI
//     POST /api/calculate-aqi
//     @param {string} audioId
//     @returns {Promise<{ audioId, aqiScore, aqiBand, metrics }>}
// ─────────────────────────────────────────────────────────────
export const calculateAQI = (audioId) => {
  return api.post('/calculate-aqi', { audioId })
    .then((res) => res.data.data);
};

// ─────────────────────────────────────────────────────────────
//  5. detectTampering
//     POST /api/detect-tampering
//     @param {string} audioId
//     @returns {Promise<{ audioId, authenticityScore, tamperingDetected, detections, summary }>}
// ─────────────────────────────────────────────────────────────
export const detectTampering = (audioId) => {
  return api.post('/detect-tampering', { audioId })
    .then((res) => res.data.data);
};

// ─────────────────────────────────────────────────────────────
//  6. getAudio
//     GET /api/:id
//     @param {string} audioId
//     @returns {Promise<{ id, filename, format, processing, results, ... }>}
// ─────────────────────────────────────────────────────────────
export const getAudio = (audioId) => {
  return api.get(`/${audioId}`)
    .then((res) => res.data.data);
};

// ─────────────────────────────────────────────────────────────
//  7. deleteAudio
//     DELETE /api/:id
//     @param {string} audioId
//     @returns {Promise<{ id }>}
// ─────────────────────────────────────────────────────────────
export const deleteAudio = (audioId) => {
  return api.delete(`/${audioId}`)
    .then((res) => res.data.data);
};

// Export the raw instance too, in case a component needs custom calls
export default api;