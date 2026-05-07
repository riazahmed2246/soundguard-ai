import axios from 'axios';

// ─── Base Axios Instance ────────────────────────────────────────────────────
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 300_000,           // 5 min – generous for AI processing
  headers: { 'Content-Type': 'application/json' },
});

// ─── Request Interceptor ─────────────────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    if (import.meta.env.DEV) {
      console.debug(`🚀 [API] ${config.method.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ─── Response Interceptor ────────────────────────────────────────────────────
api.interceptors.response.use(
  (response) => {
    if (import.meta.env.DEV) {
      console.debug(`✅ [API] ${response.config.url}`, response.data);
    }
    return response;
  },
  (error) => {
    if (import.meta.env.DEV) {
      console.error('❌ [API] Error:', error.response?.data ?? error.message);
    }

    if (error.response) {
      const { status, data } = error.response;
      const detail = data?.detail ?? data?.message ?? null;

      const messages = {
        400: detail || 'Bad request.',
        404: detail || 'Resource not found.',
        413: 'File too large. Maximum upload size is 50 MB.',
        422: detail || 'Validation error. Check your request data.',
        429: 'Too many requests. Please wait a moment and try again.',
        500: 'Server error. Please try again later.',
        503: 'Service temporarily unavailable.',
      };

      throw new ApiError(messages[status] ?? detail ?? `Request failed (${status})`, status, data);
    }

    if (error.request) {
      throw new ApiError(
        'No response from server. Check your connection and ensure the backend is running.',
        0,
      );
    }

    throw new ApiError(error.message, -1);
  },
);

// ─── Custom Error Class ──────────────────────────────────────────────────────
export class ApiError extends Error {
  /**
   * @param {string} message
   * @param {number} status   HTTP status (0 = network error, -1 = other)
   * @param {*}      data     Raw response body
   */
  constructor(message, status = 0, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// ─── Upload ──────────────────────────────────────────────────────────────────

/**
 * Upload an audio file to the backend.
 *
 * @param {File}     file           – The audio File object
 * @param {Function} [onProgress]   – Optional progress callback (0-100)
 * @returns {Promise<AudioResponse>}
 */
export const uploadAudio = async (file, onProgress) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/api/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onProgress
      ? (evt) => {
          if (evt.total) {
            onProgress(Math.round((evt.loaded * 100) / evt.total));
          }
        }
      : undefined,
  });

  return response.data;
};

// ─── Audio CRUD ───────────────────────────────────────────────────────────────

/**
 * Fetch metadata for a single audio record.
 * @param {number} audioId
 * @returns {Promise<AudioResponse>}
 */
export const getAudio = async (audioId) => {
  const response = await api.get(`/api/audio/${audioId}`);
  return response.data;
};

/**
 * List all uploaded audio files (optional pagination).
 * @param {{ page?: number, pageSize?: number }} [params]
 * @returns {Promise<PaginatedAudioResponse>}
 */
export const listAudio = async (params = {}) => {
  const response = await api.get('/api/audio', { params });
  return response.data;
};

/**
 * Delete an audio record and its associated files.
 * @param {number} audioId
 * @returns {Promise<{ message: string }>}
 */
export const deleteAudio = async (audioId) => {
  const response = await api.delete(`/api/audio/${audioId}`);
  return response.data;
};

// ─── Enhancement ─────────────────────────────────────────────────────────────

/**
 * Run AI enhancement on an uploaded audio file.
 *
 * @param {number} audioId
 * @param {object} opts
 * @param {'demucs'|'cleanunet'|'fullsubnet'} opts.model
 * @param {number}  opts.noise_reduction  0.0 – 1.0
 * @param {boolean} opts.preserve_speech
 * @param {'fast'|'balanced'|'quality'} opts.mode
 * @returns {Promise<EnhancementResponse>}
 */
export const enhanceAudio = async (audioId, opts = {}) => {
  const payload = {
    audio_id: audioId,
    model:            opts.model           ?? 'cleanunet',
    noise_reduction:  opts.noise_reduction ?? 0.8,
    preserve_speech:  opts.preserve_speech ?? true,
    mode:             opts.mode            ?? 'balanced',
  };

  const response = await api.post('/api/enhance', payload);
  return response.data;
};

// ─── AQI ──────────────────────────────────────────────────────────────────────

/**
 * Calculate the Audio Quality Index for a file.
 * @param {number} audioId
 * @returns {Promise<AQIResponse>}
 */
export const calculateAQI = async (audioId) => {
  const response = await api.post('/api/aqi/calculate', { audio_id: audioId });
  return response.data;
};

// ─── Forensics ────────────────────────────────────────────────────────────────

/**
 * Run tampering / deepfake detection on an audio file.
 * @param {number} audioId
 * @returns {Promise<ForensicsResponse>}
 */
export const detectTampering = async (audioId) => {
  const response = await api.post('/api/forensics/detect', { audio_id: audioId });
  return response.data;
};

// ─── Explainability ───────────────────────────────────────────────────────────

/**
 * Fetch noise-removal explainability report.
 * @param {number} audioId
 * @returns {Promise<ExplainabilityResponse>}
 */
export const explainDenoising = async (audioId) => {
  const response = await api.post('/api/explain', { audio_id: audioId });
  return response.data;
};

// ─── Report downloads ─────────────────────────────────────────────────────────

/**
 * Download a forensics or AQI report as a Blob.
 * @param {number} audioId
 * @param {'forensics'|'aqi'|'enhancement'} type
 * @returns {Promise<Blob>}
 */
export const downloadReport = async (audioId, type = 'forensics') => {
  const response = await api.get(`/api/report/${type}/${audioId}`, {
    responseType: 'blob',
  });
  return response.data;
};

/**
 * Helper: trigger a browser download for a Blob.
 * @param {Blob}   blob
 * @param {string} filename
 */
export const saveBlobAs = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// ─── Health check ─────────────────────────────────────────────────────────────

/**
 * Ping the backend health endpoint.
 * @returns {Promise<{ status: string }>}
 */
export const checkHealth = async () => {
  const response = await api.get('/health');
  return response.data;
};

export default api;
