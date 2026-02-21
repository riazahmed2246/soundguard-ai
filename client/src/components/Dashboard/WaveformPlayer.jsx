import { useEffect, useRef, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import {
  Play,
  Pause,
  Square,
  Volume2,
  VolumeX,
  Volume1,
  Loader2,
  Radio,
} from 'lucide-react';
import { useAudio } from '../../context/AudioContext';

// ─────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────
const SPEED_OPTIONS = [
  { label: '0.5×', value: 0.5 },
  { label: '1×',   value: 1   },
  { label: '1.5×', value: 1.5 },
  { label: '2×',   value: 2   },
];

const WAVEFORM_COLOR  = '#93C5FD'; // blue-300 — unplayed portion
const PROGRESS_COLOR  = '#1D4ED8'; // blue-700 — played portion
const CURSOR_COLOR    = '#2563EB'; // blue-600

// ─────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────
const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

const VolumeIcon = ({ volume, muted }) => {
  if (muted || volume === 0) return <VolumeX size={16} />;
  if (volume < 0.5)          return <Volume1 size={16} />;
  return <Volume2 size={16} />;
};

// ─────────────────────────────────────────────────────────────
//  Sub-component — icon button
// ─────────────────────────────────────────────────────────────
const ControlBtn = ({ onClick, disabled, title, children, variant = 'default', active = false }) => {
  const base = 'flex items-center justify-center rounded-xl transition-all duration-200 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-1';

  const styles = {
    default: `w-10 h-10 ${active ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-300 hover:text-blue-600 hover:shadow-sm'}`,
    primary: 'w-12 h-12 bg-blue-600 text-white shadow-lg shadow-blue-200 hover:bg-blue-700 hover:scale-105 active:scale-95',
    danger:  'w-10 h-10 bg-white text-slate-500 border border-slate-200 hover:border-red-300 hover:text-red-500 hover:shadow-sm',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${base} ${styles[variant]} ${disabled ? 'opacity-40 pointer-events-none' : ''}`}
    >
      {children}
    </button>
  );
};

// ─────────────────────────────────────────────────────────────
//  Sub-component — playback speed selector
// ─────────────────────────────────────────────────────────────
const SpeedSelector = ({ speed, onChange, disabled }) => (
  <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
    {SPEED_OPTIONS.map((opt) => (
      <button
        key={opt.value}
        onClick={() => onChange(opt.value)}
        disabled={disabled}
        title={`Playback speed ${opt.label}`}
        className={`
          px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-150
          focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400
          ${speed === opt.value
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-slate-500 hover:text-blue-600 hover:bg-white'}
          ${disabled ? 'opacity-40 pointer-events-none' : ''}
        `}
      >
        {opt.label}
      </button>
    ))}
  </div>
);

// ─────────────────────────────────────────────────────────────
//  Sub-component — volume control
// ─────────────────────────────────────────────────────────────
const VolumeControl = ({ volume, muted, onVolumeChange, onToggleMute, disabled }) => (
  <div className="flex items-center gap-2">
    <button
      onClick={onToggleMute}
      disabled={disabled}
      title={muted ? 'Unmute' : 'Mute'}
      className={`
        flex items-center justify-center w-7 h-7 rounded-lg text-slate-500
        hover:text-blue-600 hover:bg-blue-50 transition-colors duration-150
        focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400
        ${disabled ? 'opacity-40 pointer-events-none' : ''}
      `}
    >
      <VolumeIcon volume={volume} muted={muted} />
    </button>

    {/* Custom styled range input */}
    <div className="relative w-24 h-4 flex items-center">
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={muted ? 0 : volume}
        onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
        disabled={disabled}
        className="volume-slider w-full h-1.5 rounded-full appearance-none cursor-pointer bg-slate-200 accent-blue-600 disabled:opacity-40"
        title={`Volume: ${Math.round(volume * 100)}%`}
      />
    </div>

    <span className="text-xs font-medium text-slate-400 w-8 text-right tabular-nums">
      {muted ? '0' : Math.round(volume * 100)}%
    </span>
  </div>
);

// ─────────────────────────────────────────────────────────────
//  Sub-component — time display
// ─────────────────────────────────────────────────────────────
const TimeDisplay = ({ current, total }) => (
  <div className="flex items-center gap-1 font-mono text-sm tabular-nums">
    <span className="text-blue-600 font-semibold">{formatTime(current)}</span>
    <span className="text-slate-300">/</span>
    <span className="text-slate-500">{formatTime(total)}</span>
  </div>
);

// ─────────────────────────────────────────────────────────────
//  Sub-component — loading skeleton
// ─────────────────────────────────────────────────────────────
const WaveformSkeleton = () => (
  <div className="w-full h-24 flex items-center justify-center gap-1 bg-slate-50 rounded-xl border border-slate-200">
    <Loader2 className="w-5 h-5 text-blue-400 animate-spin mr-2" />
    <span className="text-sm text-slate-400">Loading waveform…</span>
  </div>
);

// ─────────────────────────────────────────────────────────────
//  Sub-component — seek progress bar (mini bar above waveform)
// ─────────────────────────────────────────────────────────────
const SeekBar = ({ progress }) => (
  <div className="w-full h-0.5 bg-slate-200 rounded-full overflow-hidden">
    <div
      className="h-full bg-blue-500 rounded-full transition-all duration-100"
      style={{ width: `${progress * 100}%` }}
    />
  </div>
);

// ─────────────────────────────────────────────────────────────
//  Main component
// ─────────────────────────────────────────────────────────────
const WaveformPlayer = () => {
  const { audioId, audioInfo } = useAudio();

  // ── Refs ────────────────────────────────────────────────
  const containerRef = useRef(null);  // DOM node for WaveSurfer
  const wsRef        = useRef(null);  // WaveSurfer instance

  // ── State ───────────────────────────────────────────────
  const [isReady,    setIsReady]    = useState(false);
  const [isLoading,  setIsLoading]  = useState(false);
  const [isPlaying,  setIsPlaying]  = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration,   setDuration]   = useState(0);
  const [volume,     setVolume]     = useState(0.8);
  const [muted,      setMuted]      = useState(false);
  const [speed,      setSpeed]      = useState(1);
  const [error,      setError]      = useState(null);

  // ── Build audio URL from audioInfo ─────────────────────
  const audioUrl = audioInfo?.originalUrl
    ? `http://localhost:5000${audioInfo.originalUrl}`
    : null;

  // ── Destroy existing WaveSurfer instance ───────────────
  const destroyWS = useCallback(() => {
    if (wsRef.current) {
      try { wsRef.current.destroy(); } catch (_) { /* ignore */ }
      wsRef.current = null;
    }
    setIsReady(false);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  // ── Initialise WaveSurfer ──────────────────────────────
  useEffect(() => {
    if (!audioUrl || !containerRef.current) return;

    destroyWS();
    setIsLoading(true);
    setError(null);

    const ws = WaveSurfer.create({
      container:        containerRef.current,
      waveColor:        WAVEFORM_COLOR,
      progressColor:    PROGRESS_COLOR,
      cursorColor:      CURSOR_COLOR,
      cursorWidth:      2,
      barWidth:         2,
      barGap:           1,
      barRadius:        3,
      height:           96,
      normalize:        true,
      interact:         true,
      fillParent:       true,
      mediaControls:    false,
      autoplay:         false,
    });

    wsRef.current = ws;

    // ── Event listeners ──────────────────────────────────
    ws.on('ready', () => {
      setIsLoading(false);
      setIsReady(true);
      setDuration(ws.getDuration());
      ws.setVolume(volume);
      ws.setPlaybackRate(speed);
    });

    ws.on('audioprocess', () => {
      setCurrentTime(ws.getCurrentTime());
    });

    ws.on('seek', () => {
      setCurrentTime(ws.getCurrentTime());
    });

    ws.on('play', ()  => setIsPlaying(true));
    ws.on('pause', () => setIsPlaying(false));
    ws.on('finish', () => {
      setIsPlaying(false);
      setCurrentTime(ws.getDuration());
    });

    ws.on('error', (err) => {
      console.error('[WaveformPlayer] WaveSurfer error:', err);
      setIsLoading(false);
      setError('Failed to load audio. Check that the backend is running.');
    });

    ws.load(audioUrl);

    return () => {
      ws.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl]);

  // ── Sync volume changes ─────────────────────────────────
  useEffect(() => {
    if (!wsRef.current || !isReady) return;
    wsRef.current.setVolume(muted ? 0 : volume);
  }, [volume, muted, isReady]);

  // ── Sync speed changes ──────────────────────────────────
  useEffect(() => {
    if (!wsRef.current || !isReady) return;
    wsRef.current.setPlaybackRate(speed);
  }, [speed, isReady]);

  // ── Controls ────────────────────────────────────────────
  const handlePlayPause = useCallback(() => {
    wsRef.current?.playPause();
  }, []);

  const handleStop = useCallback(() => {
    if (!wsRef.current) return;
    wsRef.current.stop();
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  const handleVolumeChange = useCallback((val) => {
    setVolume(val);
    setMuted(val === 0);
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => !prev);
  }, []);

  const handleSpeedChange = useCallback((val) => {
    setSpeed(val);
  }, []);

  // Don't render the whole player if there's no uploaded file
  if (!audioId || !audioInfo) return null;

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <section className="w-full fade-in">
      {/* ── Section header ────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white">
          <Radio size={15} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-800 leading-tight">
            Waveform Player
          </h2>
          <p className="text-xs text-slate-400">Click the waveform to seek</p>
        </div>

        {/* Live indicator when playing */}
        {isPlaying && (
          <div className="ml-auto flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            Playing
          </div>
        )}
      </div>

      {/* ── Player card ───────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

        {/* Seek progress micro-bar */}
        <SeekBar progress={progress} />

        {/* ── Waveform area ──────────────────────────────── */}
        <div className="px-4 pt-4 pb-2">
          {isLoading && <WaveformSkeleton />}

          {error && (
            <div className="w-full h-24 flex items-center justify-center bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          {/* WaveSurfer mounts here — hidden while loading to avoid FOUC */}
          <div
            ref={containerRef}
            className={`waveform-container rounded-xl ${isLoading || error ? 'hidden' : 'block'}`}
          />
        </div>

        {/* ── Controls row ───────────────────────────────── */}
        <div className="px-4 pb-4 pt-2 flex flex-col gap-3">

          {/* Row 1: transport + time */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Stop */}
            <ControlBtn
              onClick={handleStop}
              disabled={!isReady}
              title="Stop"
              variant="danger"
            >
              <Square size={16} />
            </ControlBtn>

            {/* Play / Pause — primary */}
            <ControlBtn
              onClick={handlePlayPause}
              disabled={!isReady}
              title={isPlaying ? 'Pause' : 'Play'}
              variant="primary"
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </ControlBtn>

            {/* Time display */}
            <TimeDisplay current={currentTime} total={duration} />

            {/* Spacer */}
            <div className="flex-1" />

            {/* Speed selector — hidden on very small screens */}
            <div className="hidden sm:block">
              <SpeedSelector
                speed={speed}
                onChange={handleSpeedChange}
                disabled={!isReady}
              />
            </div>
          </div>

          {/* Row 2: volume + speed (speed shown here on mobile) */}
          <div className="flex items-center gap-4 flex-wrap">
            <VolumeControl
              volume={volume}
              muted={muted}
              onVolumeChange={handleVolumeChange}
              onToggleMute={handleToggleMute}
              disabled={!isReady}
            />

            {/* Speed — mobile only */}
            <div className="sm:hidden">
              <SpeedSelector
                speed={speed}
                onChange={handleSpeedChange}
                disabled={!isReady}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Inline styles for range input thumb — Tailwind can't style ::-webkit-slider-thumb */}
      <style>{`
        .volume-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #2563eb;
          cursor: pointer;
          border: 2px solid #fff;
          box-shadow: 0 1px 3px rgba(37,99,235,0.4);
          transition: transform 0.15s ease;
        }
        .volume-slider::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }
        .volume-slider::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #2563eb;
          cursor: pointer;
          border: 2px solid #fff;
          box-shadow: 0 1px 3px rgba(37,99,235,0.4);
        }
      `}</style>
    </section>
  );
};

export default WaveformPlayer;