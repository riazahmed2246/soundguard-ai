import React from 'react';
import { useAudio } from '../../context/AudioContext';
import WaveformDisplay from './WaveformDisplay';
import AudioUpload from '../Upload/AudioUpload';

/**
 * AudioEditor – center workspace panel.
 * Shows the upload drop-zone when no file is loaded,
 * or the WaveformDisplay once a file is ready.
 */
const AudioEditor = () => {
  const { hasAudio } = useAudio();

  return (
    <div className="flex flex-col flex-1 overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      {hasAudio ? (
        /* ── Waveform view ──────────────────────────────────────────────── */
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Editor header */}
          <div
            className="flex items-center justify-between px-4 shrink-0"
            style={{
              height: 36,
              background: 'var(--bg-surface)',
              borderBottom: '1px solid var(--border-subtle)',
            }}
          >
            <span
              className="text-[10px] font-mono font-semibold uppercase tracking-widest"
              style={{ color: 'var(--text-muted)' }}
            >
              Waveform Editor
            </span>
            <div className="flex items-center gap-3">
              <AudioEditorInfo />
            </div>
          </div>

          {/* Waveform */}
          <div className="flex-1 overflow-hidden">
            <WaveformDisplay />
          </div>
        </div>
      ) : (
        /* ── Upload view ────────────────────────────────────────────────── */
        <AudioUpload />
      )}
    </div>
  );
};

/** Compact file-info chip shown in the editor header bar */
const AudioEditorInfo = () => {
  const { audioInfo, formatFileSize } = useAudio();
  if (!audioInfo) return null;

  return (
    <div className="flex items-center gap-3" style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>
      <span style={{ color: 'var(--text-muted)' }}>
        {audioInfo.sample_rate?.toLocaleString()} Hz
      </span>
      <span style={{ color: 'var(--border-strong)' }}>·</span>
      <span style={{ color: 'var(--text-muted)' }}>
        {audioInfo.channels === 2 ? 'Stereo' : 'Mono'}
      </span>
      <span style={{ color: 'var(--border-strong)' }}>·</span>
      <span style={{ color: 'var(--text-muted)' }}>
        {formatFileSize(audioInfo.file_size)}
      </span>
    </div>
  );
};

export default AudioEditor;
