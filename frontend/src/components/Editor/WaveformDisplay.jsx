import React, { useEffect, useRef, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import TimelinePlugin from 'wavesurfer.js/dist/plugins/timeline';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions';
import {
  Play, Pause, Square, SkipBack, SkipForward,
  Volume2, VolumeX, ZoomIn, ZoomOut,
} from 'lucide-react';
import { useAudio } from '../../context/AudioContext';

// ─── Time formatter ───────────────────────────────────────────────────────────
const fmt = (s) => {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
};

// ─── Speed button ─────────────────────────────────────────────────────────────
const SpeedBtn = ({ rate, active, onClick }) => (
  <button
    onClick={() => onClick(rate)}
    className="px-2 py-0.5 rounded text-[10px] font-mono transition-all"
    style={{
      background: active ? 'var(--accent-blue)' : 'var(--bg-base)',
      color:      active ? '#fff'               : 'var(--text-muted)',
      border:     `1px solid ${active ? 'var(--accent-blue)' : 'var(--border-subtle)'}`,
    }}
  >
    {rate}×
  </button>
);

// ─── WaveformDisplay ──────────────────────────────────────────────────────────
const WaveformDisplay = () => {
  const containerRef  = useRef(null);
  const timelineRef   = useRef(null);
  const wsRef         = useRef(null);   // keep WS instance in a ref so effects are stable

  const {
    audioUrl,
    setWavesurfer, setWaveformReady,
    setIsPlaying:  ctxSetPlaying,
    setCurrentTime: ctxSetTime,
    setDuration:   ctxSetDuration,
  } = useAudio();

  const [ready,        setReady]        = useState(false);
  const [playing,      setPlaying]      = useState(false);
  const [currentTime,  setCurrentTime]  = useState(0);
  const [duration,     setDuration]     = useState(0);
  const [volume,       setVolume]       = useState(0.8);
  const [muted,        setMuted]        = useState(false);
  const [zoom,         setZoom]         = useState(40);
  const [rate,         setRate]         = useState(1.0);
  const [loadError,    setLoadError]    = useState(null);

  // ── Build / rebuild WaveSurfer when audioUrl changes ──────────────────────
  useEffect(() => {
    if (!audioUrl || !containerRef.current) return;

    // Destroy previous instance
    if (wsRef.current) {
      wsRef.current.destroy();
      wsRef.current = null;
    }

    setReady(false);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setLoadError(null);

    const ws = WaveSurfer.create({
      container:     containerRef.current,
      waveColor:     '#2a4a7a',
      progressColor: 'var(--accent-blue)',
      cursorColor:   'rgba(255,255,255,0.7)',
      cursorWidth:   1,
      barWidth:      2,
      barGap:        1,
      barRadius:     2,
      height:        100,
      normalize:     true,
      backend:       'WebAudio',
      plugins: [
        TimelinePlugin.create({
          container:    timelineRef.current,
          timeInterval: 5,
          primaryLabelInterval: 30,
          style: {
            fontSize:   '10px',
            color:      'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
          },
        }),
        RegionsPlugin.create(),
      ],
    });

    ws.load(audioUrl);

    ws.on('ready', () => {
      const dur = ws.getDuration();
      setReady(true);
      setDuration(dur);
      ctxSetDuration(dur);
      setWaveformReady(true);
      ws.setVolume(volume);
      ws.zoom(zoom);
    });

    ws.on('audioprocess', (t) => {
      setCurrentTime(t);
      ctxSetTime(t);
    });

    ws.on('seeking', (t) => {
      setCurrentTime(t);
      ctxSetTime(t);
    });

    ws.on('play',   () => { setPlaying(true);  ctxSetPlaying(true);  });
    ws.on('pause',  () => { setPlaying(false); ctxSetPlaying(false); });
    ws.on('finish', () => { setPlaying(false); ctxSetPlaying(false); });

    ws.on('error', (err) => {
      console.error('[WaveSurfer]', err);
      setLoadError('Failed to decode audio. Check the file format.');
    });

    wsRef.current = ws;
    setWavesurfer(ws);

    return () => {
      ws.destroy();
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl]);

  // ── Controls ───────────────────────────────────────────────────────────────
  const togglePlay = useCallback(() => wsRef.current?.playPause(), []);
  const stop = useCallback(() => {
    if (!wsRef.current) return;
    wsRef.current.stop();
    setPlaying(false);
  }, []);
  const skip = useCallback((sec) => wsRef.current?.skip(sec), []);

  const handleVolume = useCallback((v) => {
    setVolume(v);
    wsRef.current?.setVolume(v);
    if (v > 0 && muted) { setMuted(false); wsRef.current?.setMuted(false); }
  }, [muted]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    setMuted(next);
    wsRef.current?.setMuted(next);
  }, [muted]);

  const handleZoom = useCallback((delta) => {
    const next = Math.min(200, Math.max(10, zoom + delta));
    setZoom(next);
    wsRef.current?.zoom(next);
  }, [zoom]);

  const handleRate = useCallback((r) => {
    setRate(r);
    wsRef.current?.setPlaybackRate(r);
  }, []);

  // ── Progress percentage for the track fill ─────────────────────────────────
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!audioUrl) return null;

  return (
    <div className="flex flex-col gap-0 h-full">

      {/* ── Waveform canvas ────────────────────────────────────────────────── */}
      <div
        className="relative flex-1 overflow-hidden"
        style={{ background: 'var(--bg-void)', minHeight: 120 }}
      >
        {/* Grid lines for depth */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 99px, rgba(255,255,255,0.03) 100px)',
          }}
        />

        {/* WaveSurfer mount point */}
        <div
          ref={containerRef}
          className="px-3 pt-3"
          style={{ opacity: ready ? 1 : 0.4, transition: 'opacity 0.3s' }}
        />

        {/* Timeline */}
        <div ref={timelineRef} className="px-3" />

        {/* Loading shimmer */}
        {!ready && !loadError && (
          <div className="absolute inset-0 flex items-center justify-center gap-1 pointer-events-none">
            {[...Array(40)].map((_, i) => (
              <div
                key={i}
                className="w-0.5 rounded-sm"
                style={{
                  height: `${20 + Math.random() * 60}px`,
                  background: 'var(--border-default)',
                  animation: `waveform-bar ${0.6 + Math.random() * 0.6}s ease-in-out infinite`,
                  animationDelay: `${i * 0.04}s`,
                  opacity: 0.5,
                }}
              />
            ))}
          </div>
        )}

        {/* Error state */}
        {loadError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-xs font-mono" style={{ color: 'var(--accent-red)' }}>
              ✕ {loadError}
            </p>
          </div>
        )}

        {/* Zoom controls – top-right */}
        <div className="absolute top-2 right-3 flex gap-1">
          <button
            onClick={() => handleZoom(-15)}
            disabled={zoom <= 10}
            className="btn-icon"
            data-tooltip="Zoom out"
          >
            <ZoomOut className="w-3 h-3" />
          </button>
          <button
            onClick={() => handleZoom(15)}
            disabled={zoom >= 200}
            className="btn-icon"
            data-tooltip="Zoom in"
          >
            <ZoomIn className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* ── Transport bar ──────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-4 px-4 shrink-0"
        style={{
          height: 52,
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        {/* Play / stop / skip */}
        <div className="flex items-center gap-1">
          <button
            className="btn-icon"
            onClick={() => skip(-5)}
            disabled={!ready}
            data-tooltip="−5 s"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          <button
            className="play-btn"
            onClick={togglePlay}
            disabled={!ready}
            style={{ width: 32, height: 32, opacity: ready ? 1 : 0.4 }}
          >
            {playing
              ? <Pause  className="w-3.5 h-3.5 text-white" />
              : <Play   className="w-3.5 h-3.5 text-white ml-0.5" />
            }
          </button>

          <button
            className="btn-icon"
            onClick={stop}
            disabled={!ready}
            data-tooltip="Stop"
          >
            <Square className="w-3 h-3" />
          </button>

          <button
            className="btn-icon"
            onClick={() => skip(5)}
            disabled={!ready}
            data-tooltip="+5 s"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Time display */}
        <div
          className="font-mono text-xs tabular-nums px-2 py-0.5 rounded"
          style={{
            background: 'var(--bg-base)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)',
            minWidth: 90,
            textAlign: 'center',
          }}
        >
          {fmt(currentTime)} <span style={{ color: 'var(--text-disabled)' }}>/</span> {fmt(duration)}
        </div>

        {/* Progress mini-track (clickable seek) */}
        <div className="flex-1 h-1 rounded-full overflow-hidden cursor-pointer relative"
          style={{ background: 'var(--bg-overlay)' }}
          onClick={(e) => {
            if (!wsRef.current || !duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            wsRef.current.seekTo(Math.min(1, Math.max(0, ratio)));
          }}
        >
          <div
            className="h-full rounded-full transition-none"
            style={{ width: `${pct}%`, background: 'var(--accent-blue)' }}
          />
        </div>

        {/* Speed buttons */}
        <div className="flex items-center gap-1">
          {[0.5, 0.75, 1.0, 1.5, 2.0].map((r) => (
            <SpeedBtn key={r} rate={r} active={rate === r} onClick={handleRate} />
          ))}
        </div>

        {/* Volume */}
        <div className="flex items-center gap-2 shrink-0">
          <button className="btn-icon" onClick={toggleMute} data-tooltip={muted ? 'Unmute' : 'Mute'}>
            {muted || volume === 0
              ? <VolumeX className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
              : <Volume2 className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
            }
          </button>
          <input
            type="range"
            min="0" max="1" step="0.01"
            value={muted ? 0 : volume}
            onChange={(e) => handleVolume(parseFloat(e.target.value))}
            className="slider-track"
            style={{ width: 72,
              background: `linear-gradient(to right, var(--accent-blue) 0%, var(--accent-blue) ${(muted ? 0 : volume) * 100}%, var(--bg-overlay) ${(muted ? 0 : volume) * 100}%, var(--bg-overlay) 100%)`,
            }}
          />
          <span className="font-mono text-[10px] w-7 text-right" style={{ color: 'var(--text-muted)' }}>
            {Math.round((muted ? 0 : volume) * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
};

export default WaveformDisplay;
