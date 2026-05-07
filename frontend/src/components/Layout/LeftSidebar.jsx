import React, { useState } from 'react';
import { FileAudio, Info, Trash2, Clock } from 'lucide-react';
import { useAudio } from '../../context/AudioContext';
import { deleteAudio } from '../../services/api';

// ─── Info row ─────────────────────────────────────────────────────────────────
const InfoRow = ({ label, value }) => (
  <div
    className="flex items-center justify-between py-1.5 px-3"
    style={{ borderBottom: '1px solid var(--border-subtle)' }}
  >
    <span className="mono-label">{label}</span>
    <span className="mono-value truncate max-w-[110px] text-right" title={String(value)}>
      {value ?? '—'}
    </span>
  </div>
);

// ─── Score badge ──────────────────────────────────────────────────────────────
const ScoreBadge = ({ label, score, good = 70, fair = 40 }) => {
  if (score == null) return null;
  const cls = score >= good ? 'badge-good' : score >= fair ? 'badge-fair' : 'badge-poor';
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <span className="mono-label">{label}</span>
      <span className={`badge ${cls}`}>{score.toFixed(0)}</span>
    </div>
  );
};

// ─── LeftSidebar ──────────────────────────────────────────────────────────────
const LeftSidebar = () => {
  const {
    audioInfo, audioId, hasAudio,
    aqiResults, forensicsResults,
    resetAudio, notify, formatFileSize, formatTime,
  } = useAudio();

  const [activeTab, setActiveTab] = useState('info'); // 'info' | 'history'
  const [deleting,  setDeleting]  = useState(false);

  const handleDelete = async () => {
    if (!audioId || deleting) return;
    if (!window.confirm('Delete this audio file?')) return;
    setDeleting(true);
    try {
      await deleteAudio(audioId);
      resetAudio();
      notify('info', 'Audio deleted.');
    } catch (err) {
      notify('error', `Delete failed: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <aside
      className="flex flex-col shrink-0 overflow-hidden"
      style={{
        width: 'var(--sidebar-width)',
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-default)',
      }}
    >
      {/* ── Tab bar ───────────────────────────────────────────────────────── */}
      <div className="tab-bar shrink-0">
        <button
          className={`tab-item ${activeTab === 'info' ? 'active' : ''}`}
          onClick={() => setActiveTab('info')}
        >
          <Info className="w-3 h-3 inline mr-1" />
          Info
        </button>
        <button
          className={`tab-item ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <Clock className="w-3 h-3 inline mr-1" />
          History
        </button>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {activeTab === 'info' && (
          <>
            {/* File icon + name */}
            <div
              className="flex flex-col items-center gap-2 px-4 py-5"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{
                  background: hasAudio ? 'rgba(77,143,255,0.12)' : 'var(--bg-overlay)',
                  border: `1px solid ${hasAudio ? 'rgba(77,143,255,0.25)' : 'var(--border-subtle)'}`,
                }}
              >
                <FileAudio
                  className="w-5 h-5"
                  style={{ color: hasAudio ? 'var(--accent-blue)' : 'var(--text-disabled)' }}
                />
              </div>

              {hasAudio && audioInfo ? (
                <>
                  <p
                    className="text-xs font-semibold text-center leading-snug w-full truncate px-1"
                    style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}
                    title={audioInfo.filename}
                  >
                    {audioInfo.filename}
                  </p>
                  <span className="badge badge-info">{audioInfo.format}</span>
                </>
              ) : (
                <p className="text-xs text-center" style={{ color: 'var(--text-disabled)' }}>
                  No file loaded
                </p>
              )}
            </div>

            {/* Metadata rows */}
            {hasAudio && audioInfo && (
              <>
                <p className="section-header">File Details</p>
                <InfoRow label="Duration"    value={formatTime(audioInfo.duration)} />
                <InfoRow label="Sample Rate" value={`${audioInfo.sample_rate?.toLocaleString()} Hz`} />
                <InfoRow label="Channels"    value={audioInfo.channels === 2 ? 'Stereo' : 'Mono'} />
                <InfoRow label="Bit Rate"    value={audioInfo.bitrate ? `${Math.round(audioInfo.bitrate / 1000)} kbps` : '—'} />
                <InfoRow label="File Size"   value={formatFileSize(audioInfo.file_size)} />
                <InfoRow label="Format"      value={audioInfo.format} />

                {/* Analysis scores */}
                {(aqiResults || forensicsResults) && (
                  <>
                    <p className="section-header mt-1">Analysis Scores</p>
                    <ScoreBadge label="AQI Score"         score={aqiResults?.overall_score} />
                    <ScoreBadge label="Authenticity"      score={forensicsResults?.authenticity_score} />
                  </>
                )}

                {/* Delete button */}
                <div className="px-3 pt-4 pb-3">
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="btn-danger w-full justify-center gap-1.5 text-xs py-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {deleting ? 'Deleting…' : 'Delete File'}
                  </button>
                </div>
              </>
            )}

            {/* Empty state hint */}
            {!hasAudio && (
              <div className="flex flex-col items-center gap-3 px-4 py-8">
                <p className="text-xs text-center leading-relaxed"
                   style={{ color: 'var(--text-disabled)' }}>
                  Upload an audio file to see metadata and analysis scores here.
                </p>
              </div>
            )}
          </>
        )}

        {activeTab === 'history' && (
          <RecentFiles />
        )}
      </div>
    </aside>
  );
};

// ─── Recent Files (placeholder) ───────────────────────────────────────────────
const RecentFiles = () => (
  <div className="flex flex-col items-center gap-3 px-4 py-8">
    <Clock className="w-8 h-8" style={{ color: 'var(--text-disabled)' }} />
    <p className="text-xs text-center" style={{ color: 'var(--text-disabled)' }}>
      Recent files will appear here after you upload audio.
    </p>
  </div>
);

export default LeftSidebar;
