import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

const AudioContext = createContext(null);

export const useAudio = () => {
  const ctx = useContext(AudioContext);
  if (!ctx) throw new Error('useAudio must be used within <AudioProvider>');
  return ctx;
};

export const AudioProvider = ({ children }) => {

  // ── Theme ──────────────────────────────────────────────────────────────────
  const [theme, setTheme] = useState(() =>
    localStorage.getItem('sg-theme') || 'dark'
  );

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('sg-theme', theme);
  }, [theme]);

  // ── File / upload state ────────────────────────────────────────────────────
  const [audioFile, setAudioFile]   = useState(null);
  const [audioId,   setAudioId]     = useState(null);
  const [audioInfo, setAudioInfo]   = useState(null);
  const [audioUrl,  setAudioUrl]    = useState(null);

  // ── Processing state ───────────────────────────────────────────────────────
  const [isProcessing,       setIsProcessing]       = useState(false);
  const [processingStatus,   setProcessingStatus]   = useState('');
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingError,    setProcessingError]    = useState(null);

  // ── Playback state ─────────────────────────────────────────────────────────
  const [isPlaying,    setIsPlaying]    = useState(false);
  const [currentTime,  setCurrentTime]  = useState(0);
  const [duration,     setDuration]     = useState(0);
  const [volume,       setVolume]       = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isMuted,      setIsMuted]      = useState(false);

  // ── Waveform ───────────────────────────────────────────────────────────────
  const [waveformReady,    setWaveformReady]    = useState(false);
  const [wavesurfer,       setWavesurfer]       = useState(null);
  const [zoom,             setZoom]             = useState(1);
  const [showSpectrogram,  setShowSpectrogram]  = useState(false);

  // ── UI ─────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('tools');

  // ── Results ────────────────────────────────────────────────────────────────
  const [enhancementResults,    setEnhancementResults]    = useState(null);
  const [enhancedAudioUrl,      setEnhancedAudioUrl]      = useState(null);
  const [selectedModel,         setSelectedModel]         = useState('cleanunet');
  const [noiseReduction,        setNoiseReduction]        = useState(0.8);
  const [preserveSpeech,        setPreserveSpeech]        = useState(true);
  const [processingMode,        setProcessingMode]        = useState('balanced');
  const [aqiResults,            setAqiResults]            = useState(null);
  const [forensicsResults,      setForensicsResults]      = useState(null);
  const [explainabilityResults, setExplainabilityResults] = useState(null);

  // ── Notifications ──────────────────────────────────────────────────────────
  const [notifications, setNotifications] = useState([]);
  const notifIdRef = useRef(0);

  const hasAudio = Boolean(audioId && audioUrl);

  const formatTime = useCallback((seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }, []);

  const formatFileSize = useCallback((bytes) => {
    if (!bytes) return '—';
    if (bytes < 1024)        return `${bytes} B`;
    if (bytes < 1048576)     return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(2)} MB`;
  }, []);

  const startProcessing = useCallback((label = 'Processing…') => {
    setIsProcessing(true);
    setProcessingStatus(label);
    setProcessingProgress(0);
    setProcessingError(null);
  }, []);

  const updateProgress = useCallback((pct, label) => {
    setProcessingProgress(Math.min(100, Math.max(0, pct)));
    if (label) setProcessingStatus(label);
  }, []);

  const finishProcessing = useCallback(() => {
    setProcessingProgress(100);
    setTimeout(() => {
      setIsProcessing(false);
      setProcessingStatus('');
      setProcessingProgress(0);
    }, 400);
  }, []);

  const failProcessing = useCallback((message = 'Processing failed') => {
    setIsProcessing(false);
    setProcessingStatus('');
    setProcessingProgress(0);
    setProcessingError(message);
  }, []);

  const notify = useCallback((type, message, dur = 4000) => {
    const id = ++notifIdRef.current;
    setNotifications(prev => [...prev, { id, type, message }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), dur);
  }, []);

  const dismissNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const play  = useCallback(() => { if (wavesurfer) { wavesurfer.play();  setIsPlaying(true);  } }, [wavesurfer]);
  const pause = useCallback(() => { if (wavesurfer) { wavesurfer.pause(); setIsPlaying(false); } }, [wavesurfer]);

  const togglePlay = useCallback(() => {
    if (!wavesurfer) return;
    if (isPlaying) { wavesurfer.pause(); setIsPlaying(false); }
    else           { wavesurfer.play();  setIsPlaying(true);  }
  }, [wavesurfer, isPlaying]);

  const seek = useCallback((time) => {
    if (wavesurfer && duration > 0) { wavesurfer.seekTo(time / duration); setCurrentTime(time); }
  }, [wavesurfer, duration]);

  const changeVolume = useCallback((v) => {
    const c = Math.min(1, Math.max(0, v));
    setVolume(c);
    if (wavesurfer) wavesurfer.setVolume(c);
  }, [wavesurfer]);

  const toggleMute = useCallback(() => {
    const next = !isMuted;
    setIsMuted(next);
    if (wavesurfer) wavesurfer.setMuted(next);
  }, [wavesurfer, isMuted]);

  const changePlaybackRate = useCallback((rate) => {
    setPlaybackRate(rate);
    if (wavesurfer) wavesurfer.setPlaybackRate(rate);
  }, [wavesurfer]);

  const resetAudio = useCallback(() => {
    if (audioUrl)         URL.revokeObjectURL(audioUrl);
    if (enhancedAudioUrl) URL.revokeObjectURL(enhancedAudioUrl);
    if (wavesurfer) { try { wavesurfer.destroy(); } catch (_) {} }
    setAudioFile(null); setAudioId(null); setAudioInfo(null); setAudioUrl(null);
    setEnhancedAudioUrl(null); setIsProcessing(false); setProcessingStatus('');
    setProcessingProgress(0); setProcessingError(null); setIsPlaying(false);
    setCurrentTime(0); setDuration(0); setWaveformReady(false); setWavesurfer(null);
    setZoom(1); setShowSpectrogram(false); setEnhancementResults(null);
    setAqiResults(null); setForensicsResults(null); setExplainabilityResults(null);
  }, [audioUrl, enhancedAudioUrl, wavesurfer]);

  const value = {
    // Theme
    theme, setTheme, toggleTheme,
    // Audio
    audioFile, setAudioFile, audioId, setAudioId,
    audioInfo, setAudioInfo, audioUrl, setAudioUrl, hasAudio,
    // Processing
    isProcessing, setIsProcessing, processingStatus, setProcessingStatus,
    processingProgress, setProcessingProgress, processingError, setProcessingError,
    startProcessing, updateProgress, finishProcessing, failProcessing,
    // Playback
    isPlaying, setIsPlaying, currentTime, setCurrentTime, duration, setDuration,
    volume, playbackRate, isMuted,
    play, pause, togglePlay, seek, changeVolume, toggleMute, changePlaybackRate,
    // Waveform
    waveformReady, setWaveformReady, wavesurfer, setWavesurfer,
    zoom, setZoom, showSpectrogram, setShowSpectrogram,
    // UI
    activeTab, setActiveTab,
    // Results
    enhancementResults, setEnhancementResults,
    enhancedAudioUrl, setEnhancedAudioUrl,
    selectedModel, setSelectedModel, noiseReduction, setNoiseReduction,
    preserveSpeech, setPreserveSpeech, processingMode, setProcessingMode,
    aqiResults, setAqiResults, forensicsResults, setForensicsResults,
    explainabilityResults, setExplainabilityResults,
    // Notifications
    notifications, notify, dismissNotification,
    // Utils
    formatTime, formatFileSize, resetAudio,
  };

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>;
};

export default AudioContext;
