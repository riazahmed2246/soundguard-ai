// MainLayout.jsx

import React, { useEffect, useRef } from 'react';
import TopBar from './TopBar';
import LeftSidebar from './LeftSidebar';
import RightPanel from './RightPanel';
import AudioEditor from '../Editor/AudioEditor';
import { useAudio } from '../../context/AudioContext';

// ─── Notification Toast ───────────────────────────────────────────────────────
const Toast = ({ notification, onDismiss }) => {
  const styles = {
    success: { bar: 'bg-[--accent-green]', icon: '✓', text: 'text-[--accent-green]' },
    error:   { bar: 'bg-[--accent-red]',   icon: '✕', text: 'text-[--accent-red]'   },
    info:    { bar: 'bg-[--accent-blue]',  icon: 'i', text: 'text-[--accent-blue]'  },
    warning: { bar: 'bg-[--accent-amber]', icon: '!', text: 'text-[--accent-amber]' },
  };
  const s = styles[notification.type] ?? styles.info;

  return (
    <div
      className="animate-slide-in-right flex items-start gap-3 bg-[--bg-overlay] border border-[--border-default] rounded-lg px-4 py-3 shadow-xl min-w-[260px] max-w-[340px] overflow-hidden relative cursor-pointer"
      onClick={() => onDismiss(notification.id)}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${s.bar}`} />
      <span className={`font-mono text-xs font-bold mt-px ${s.text}`}>[{s.icon}]</span>
      <p className="text-[--text-secondary] text-xs leading-snug">{notification.message}</p>
    </div>
  );
};

// ─── Processing Overlay ───────────────────────────────────────────────────────
const ProcessingOverlay = ({ status, progress }) => (
  <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
    <div
      className="bg-[--bg-elevated] border border-[--border-default] rounded-xl p-8 w-80 shadow-2xl"
      style={{ boxShadow: 'var(--glow-blue)' }}
    >
      {/* Animated VU meter bars */}
      <div className="flex items-end justify-center gap-1 h-10 mb-6">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="vu-bar w-1.5 rounded-sm"
            style={{
              height: `${30 + Math.sin(i * 0.8) * 24}%`,
              background: `hsl(${200 + i * 8}, 80%, 60%)`,
              animationDelay: `${i * 0.07}s`,
              animationDuration: `${0.7 + (i % 3) * 0.15}s`,
            }}
          />
        ))}
      </div>

      <h3 className="text-sm font-semibold text-center mb-1 font-[--font-display] tracking-wide">
        Processing Audio
      </h3>
      <p className="text-xs text-[--text-secondary] text-center mb-5">{status}</p>

      {/* Progress bar */}
      <div className="progress-track mb-2">
        <div
          className="progress-fill"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex justify-between items-center">
        <span className="font-mono text-[10px] text-[--text-muted]">
          {progress < 100 ? 'working…' : 'finishing…'}
        </span>
        <span className="font-mono text-[10px] text-[--accent-blue]">
          {progress}%
        </span>
      </div>
    </div>
  </div>
);

// ─── Status Bar ───────────────────────────────────────────────────────────────
const StatusBar = () => {
  const {
    audioInfo, hasAudio, isPlaying,
    currentTime, duration, formatTime,
    processingError,
  } = useAudio();

  return (
    <div
      className="flex items-center justify-between px-4 text-[10.5px] font-mono text-[--text-muted] border-t border-[--border-subtle] select-none"
      style={{ height: 'var(--statusbar-height)', background: 'var(--bg-void)' }}
    >
      {/* Left */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              processingError ? 'bg-[--accent-red] animate-pulse-glow' :
              isPlaying        ? 'bg-[--accent-green] animate-pulse-glow' :
              hasAudio         ? 'bg-[--accent-blue]' :
                                 'bg-[--text-disabled]'
            }`}
          />
          <span>
            {processingError ? 'Error' : isPlaying ? 'Playing' : hasAudio ? 'Ready' : 'No file loaded'}
          </span>
        </div>

        {hasAudio && audioInfo && (
          <>
            <span className="text-[--border-strong]">|</span>
            <span>{audioInfo.sample_rate?.toLocaleString()} Hz</span>
            <span className="text-[--border-strong]">|</span>
            <span>{audioInfo.channels === 2 ? 'Stereo' : 'Mono'}</span>
            <span className="text-[--border-strong]">|</span>
            <span>{audioInfo.format}</span>
          </>
        )}

        {processingError && (
          <>
            <span className="text-[--border-strong]">|</span>
            <span className="text-[--accent-red]">{processingError}</span>
          </>
        )}
      </div>

      {/* Center */}
      {hasAudio && (
        <div className="flex items-center gap-1 text-[--text-secondary]">
          <span>{formatTime(currentTime)}</span>
          <span className="text-[--text-disabled]">/</span>
          <span>{formatTime(duration)}</span>
        </div>
      )}

      {/* Right */}
      <div className="flex items-center gap-3 text-[--text-disabled]">
        <span>SoundGuard AI</span>
        <span className="text-[--border-strong]">|</span>
        <span>v1.0.0</span>
      </div>
    </div>
  );
};

// ─── Main Layout ──────────────────────────────────────────────────────────────
const MainLayout = () => {
  const {
    isProcessing, processingStatus, processingProgress,
    notifications, dismissNotification,
  } = useAudio();

  // Close dropdown menus on outside click
  const layoutRef = useRef(null);

  return (
    <div
      ref={layoutRef}
      className="flex flex-col overflow-hidden"
      style={{ height: '100vh', background: 'var(--bg-void)' }}
    >
      {/* ── Top navigation ─────────────────────────────────────────────── */}
      <TopBar />

      {/* ── Main three-column workspace ───────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* Left sidebar */}
        <LeftSidebar />

        {/* Vertical resize handle (cosmetic) */}
        <div className="resize-handle-x" />

        {/* Center audio editor */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          <AudioEditor />

          {/* Processing overlay – portaled inside main to contain blur */}
          {isProcessing && (
            <ProcessingOverlay
              status={processingStatus}
              progress={processingProgress}
            />
          )}
        </main>

        {/* Vertical resize handle (cosmetic) */}
        <div className="resize-handle-x" />

        {/* Right analysis panel */}
        <RightPanel />
      </div>

      {/* ── Status bar ─────────────────────────────────────────────────── */}
      <StatusBar />

      {/* ── Toast notifications ────────────────────────────────────────── */}
      <div className="fixed bottom-10 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
        {notifications.map((n) => (
          <div key={n.id} className="pointer-events-auto">
            <Toast notification={n} onDismiss={dismissNotification} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default MainLayout;
