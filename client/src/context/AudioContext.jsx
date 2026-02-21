import { createContext, useContext, useState, useCallback } from 'react';

// ─────────────────────────────────────────────────────────────
//  Context creation
// ─────────────────────────────────────────────────────────────
const AudioContext = createContext(null);

// ─────────────────────────────────────────────────────────────
//  Provider
// ─────────────────────────────────────────────────────────────
export const AudioProvider = ({ children }) => {
  // ── Raw File ──────────────────────────────────────────────
  // The browser File object selected / dropped by the user.
  const [audioFile, setAudioFile] = useState(null);

  // ── MongoDB record ID ─────────────────────────────────────
  // Set after a successful POST /api/upload response.
  const [audioId, setAudioId] = useState(null);

  // ── Metadata ──────────────────────────────────────────────
  // Shape returned by the backend:
  // { filename, format, duration, durationFormatted, sampleRate,
  //   channels, channelLabel, fileSize, fileSizeFormatted,
  //   bitrate, uploadDate, originalUrl, enhancedUrl }
  const [audioInfo, setAudioInfo] = useState(null);

  // ── Processing flag ───────────────────────────────────────
  // True while any API call to a Python module is in-flight.
  const [isProcessing, setIsProcessing] = useState(false);

  // ── Active module ─────────────────────────────────────────
  // null | 'enhancement' | 'explainability' | 'aqi' | 'forensics'
  const [activeModule, setActiveModule] = useState(null);

  // ── Per-module results ────────────────────────────────────
  // Each key holds whatever the backend returned for that module.
  const [moduleResults, setModuleResults] = useState({
    enhancement:    null,
    explainability: null,
    aqi:            null,
    forensics:      null,
  });

  // ── Upload progress ───────────────────────────────────────
  // 0–100, used by the upload progress bar.
  const [uploadProgress, setUploadProgress] = useState(0);

  // ── Error state ───────────────────────────────────────────
  const [error, setError] = useState(null);

  // ─────────────────────────────────────────────────────────
  //  Actions (memoised so child components don't re-render
  //  unnecessarily when passing them as props)
  // ─────────────────────────────────────────────────────────

  /** Called when a new file is selected — resets all derived state */
  const handleNewFile = useCallback((file) => {
    setAudioFile(file);
    setAudioId(null);
    setAudioInfo(null);
    setModuleResults({ enhancement: null, explainability: null, aqi: null, forensics: null });
    setUploadProgress(0);
    setError(null);
    setActiveModule(null);
  }, []);

  /** Called after a successful upload response from the backend */
  const handleUploadSuccess = useCallback((id, info) => {
    setAudioId(id);
    setAudioInfo(info);
    setUploadProgress(100);
    setError(null);
  }, []);

  /** Store results for a specific module */
  const saveModuleResult = useCallback((moduleName, data) => {
    setModuleResults((prev) => ({ ...prev, [moduleName]: data }));
  }, []);

  /** Open a module modal */
  const openModule = useCallback((moduleName) => {
    setActiveModule(moduleName);
    setError(null);
  }, []);

  /** Close the currently open module modal */
  const closeModule = useCallback(() => {
    setActiveModule(null);
  }, []);

  /** Reset everything — e.g. "upload a different file" */
  const resetAll = useCallback(() => {
    setAudioFile(null);
    setAudioId(null);
    setAudioInfo(null);
    setIsProcessing(false);
    setActiveModule(null);
    setModuleResults({ enhancement: null, explainability: null, aqi: null, forensics: null });
    setUploadProgress(0);
    setError(null);
  }, []);

  // ─────────────────────────────────────────────────────────
  //  Context value
  // ─────────────────────────────────────────────────────────
  const value = {
    // State
    audioFile,
    audioId,
    audioInfo,
    isProcessing,
    activeModule,
    moduleResults,
    uploadProgress,
    error,

    // Raw setters (for fine-grained control in components)
    setAudioFile,
    setAudioId,
    setAudioInfo,
    setIsProcessing,
    setActiveModule,
    setModuleResults,
    setUploadProgress,
    setError,

    // Compound actions
    handleNewFile,
    handleUploadSuccess,
    saveModuleResult,
    openModule,
    closeModule,
    resetAll,
  };

  return (
    <AudioContext.Provider value={value}>
      {children}
    </AudioContext.Provider>
  );
};

// ─────────────────────────────────────────────────────────────
//  Custom hook — throws a helpful error if used outside provider
// ─────────────────────────────────────────────────────────────
export const useAudio = () => {
  const ctx = useContext(AudioContext);
  if (!ctx) {
    throw new Error('useAudio must be used inside <AudioProvider>');
  }
  return ctx;
};

export default AudioContext;