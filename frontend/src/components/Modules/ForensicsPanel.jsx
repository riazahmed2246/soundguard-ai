import React, { useState, useCallback } from 'react';
import { Shield, ShieldAlert, ShieldCheck, ShieldX, FileText, AlertTriangle, CheckCircle2, Download } from 'lucide-react';
import { detectTampering } from '../../services/api';
import { useAudio } from '../../context/AudioContext';

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  authentic:         { icon: ShieldCheck, badgeClass: 'badge-good',    label: 'Authentic',          color: 'var(--accent-green)'  },
  suspicious:        { icon: ShieldAlert, badgeClass: 'badge-fair',    label: 'Suspicious',         color: 'var(--accent-amber)'  },
  modified:          { icon: ShieldAlert, badgeClass: 'badge-poor',    label: 'Modified',           color: 'var(--accent-red)'    },
  severely_modified: { icon: ShieldX,     badgeClass: 'badge-poor',    label: 'Severely Modified',  color: 'var(--accent-red)'    },
};

const SEVERITY_CONFIG = {
  high:   { color: 'var(--accent-red)',   dotClass: 'detection-dot-high'   },
  medium: { color: 'var(--accent-amber)', dotClass: 'detection-dot-medium' },
  low:    { color: 'var(--accent-green)', dotClass: 'detection-dot-low'    },
};

const fmt = (s) => {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60), sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
};

// ─── Authenticity score ring ──────────────────────────────────────────────────
const AuthRing = ({ score, status }) => {
  const r = 42, circ = 2 * Math.PI * r;
  const cfg   = STATUS_CONFIG[status] ?? STATUS_CONFIG.modified;
  const filled = (score / 100) * circ;

  return (
    <div className="relative flex items-center justify-center" style={{ width: 110, height: 110 }}>
      <svg width={110} height={110} className="-rotate-90" style={{ position: 'absolute' }}>
        <circle cx={55} cy={55} r={r} fill="none" stroke="var(--bg-overlay)" strokeWidth={6} />
        <circle cx={55} cy={55} r={r} fill="none"
                stroke={cfg.color} strokeWidth={6}
                strokeDasharray={`${filled} ${circ - filled}`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 0.6s var(--ease-snap)' }} />
      </svg>
      <div className="z-10 flex flex-col items-center">
        <span className="font-mono text-xl font-bold leading-none" style={{ color: cfg.color }}>
          {score.toFixed(0)}
        </span>
        <span className="text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>/100</span>
      </div>
    </div>
  );
};

// ─── Timeline bar ─────────────────────────────────────────────────────────────
const TimelineBar = ({ duration, detections }) => {
  if (!duration) return null;

  return (
    <div>
      <p className="section-header mb-2" style={{ padding: 0, border: 'none' }}>
        Audio Timeline
      </p>
      <div
        className="relative h-6 rounded overflow-hidden"
        style={{ background: 'rgba(35,209,139,0.18)', border: '1px solid rgba(35,209,139,0.25)' }}
      >
        {/* Tampered zones */}
        {detections.map((d, i) => {
          const pct  = (d.timestamp / duration) * 100;
          const width = Math.max(0.8, (0.2 / duration) * 100);
          return (
            <div
              key={i}
              title={`${d.type} @ ${d.timestamp}s  confidence ${Math.round(d.confidence * 100)}%`}
              className="absolute top-0 h-full"
              style={{
                left:       `${Math.min(99, pct)}%`,
                width:      `${width}%`,
                background: d.severity === 'high' ? 'var(--accent-red)' : 'var(--accent-amber)',
                opacity:    0.85,
              }}
            />
          );
        })}
      </div>

      {/* Tick labels */}
      <div className="flex justify-between mt-1">
        <span className="font-mono text-[9px]" style={{ color: 'var(--text-disabled)' }}>0:00</span>
        <span className="font-mono text-[9px]" style={{ color: 'var(--text-disabled)' }}>
          {fmt(duration / 2)}
        </span>
        <span className="font-mono text-[9px]" style={{ color: 'var(--text-disabled)' }}>
          {fmt(duration)}
        </span>
      </div>
    </div>
  );
};

// ─── Detection card ───────────────────────────────────────────────────────────
const DetectionCard = ({ det }) => {
  const sc = SEVERITY_CONFIG[det.severity] ?? SEVERITY_CONFIG.low;
  return (
    <div className="detection-row rounded-lg"
         style={{ border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
      <div className={`detection-dot ${sc.dotClass}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-xs font-semibold capitalize" style={{ color: 'var(--text-primary)' }}>
            {det.type === 'splice' ? 'Splice Detected' : 'Edit Detected'}
          </span>
          <span
            className="text-[9px] font-mono px-1.5 py-0.5 rounded capitalize"
            style={{
              background: `${sc.color}22`,
              color:       sc.color,
              border:      `1px solid ${sc.color}44`,
            }}
          >
            {det.severity}
          </span>
        </div>
        <p className="text-[10.5px] leading-snug mb-1" style={{ color: 'var(--text-muted)' }}>
          {det.description}
        </p>
        <div className="flex gap-3">
          <span className="font-mono text-[10px]" style={{ color: 'var(--text-disabled)' }}>
            ⏱ {det.timestamp}s
          </span>
          <span className="font-mono text-[10px]" style={{ color: 'var(--text-disabled)' }}>
            conf. {Math.round(det.confidence * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
};

// ─── ForensicsPanel ───────────────────────────────────────────────────────────
const ForensicsPanel = () => {
  const {
    audioId, hasAudio, audioInfo,
    forensicsResults, setForensicsResults,
    startProcessing, updateProgress, finishProcessing, failProcessing,
    notify,
  } = useAudio();

  const [results, setResults] = useState(forensicsResults);
  const [running, setRunning] = useState(false);

  const handleAnalyze = useCallback(async () => {
    if (!audioId) return;
    setRunning(true);
    startProcessing('Running forensic analysis…');

    let pct = 5;
    const ticker = setInterval(() => {
      pct = Math.min(pct + 10, 88);
      updateProgress(pct,
        pct < 35 ? 'Computing spectral flux…' :
        pct < 65 ? 'Detecting discontinuities…' :
                   'Scoring authenticity…');
    }, 420);

    try {
      const response = await detectTampering(audioId);
      clearInterval(ticker);
      finishProcessing();
      setResults(response);
      setForensicsResults(response);
      const n = response.detections?.length ?? 0;
      notify(
        n === 0 ? 'success' : 'warning',
        n === 0
          ? `Authentic — no tampering found (${response.authenticity_score}/100)`
          : `${n} detection${n > 1 ? 's' : ''} — score ${response.authenticity_score}/100`,
      );
    } catch (err) {
      clearInterval(ticker);
      failProcessing(err.message);
      notify('error', `Forensic analysis failed: ${err.message}`);
    } finally {
      setRunning(false);
    }
  }, [audioId, startProcessing, updateProgress, finishProcessing, failProcessing, setForensicsResults, notify]);

  const cfg       = results ? (STATUS_CONFIG[results.status] ?? STATUS_CONFIG.modified) : null;
  const StatusIcon = cfg?.icon ?? Shield;
  const duration  = audioInfo?.duration ?? 0;

  return (
    <div className="flex flex-col gap-4 p-3">

      {/* Analyse button */}
      <button
        onClick={handleAnalyze}
        disabled={!hasAudio || running}
        className="btn-primary w-full justify-center gap-2 py-2.5 text-sm"
        style={{ opacity: (!hasAudio || running) ? 0.45 : 1 }}
      >
        <Shield className="w-4 h-4" />
        <span>{running ? 'Analysing…' : results ? 'Re-analyse' : 'Run Forensic Analysis'}</span>
      </button>

      {results && (
        <div className="flex flex-col gap-4 animate-slide-in-up">

          {/* Score card */}
          <div
            className="flex items-center gap-4 p-4 rounded-xl"
            style={{ background: 'var(--bg-base)', border: '1px solid var(--border-default)' }}
          >
            <AuthRing score={results.authenticity_score} status={results.status} />
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-mono uppercase tracking-widest"
                    style={{ color: 'var(--text-muted)' }}>
                Authenticity
              </span>
              <span className={`badge ${cfg.badgeClass} gap-1`}>
                <StatusIcon className="w-3 h-3" />
                {cfg.label}
              </span>
              <span className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
                {results.detections.length === 0
                  ? 'No tampering found'
                  : `${results.detections.length} detection${results.detections.length > 1 ? 's' : ''}`}
              </span>
            </div>
          </div>

          {/* Timeline */}
          <div className="p-3 rounded-lg"
               style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
            <TimelineBar duration={duration} detections={results.detections} />
          </div>

          {/* Detections list */}
          {results.detections.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="section-header" style={{ padding: '0 0 6px', border: 'none' }}>
                Detections
              </p>
              {results.detections.map((d, i) => (
                <DetectionCard key={i} det={d} />
              ))}
            </div>
          ) : (
            <div
              className="flex flex-col items-center gap-2 py-5 rounded-xl"
              style={{
                background: 'rgba(35,209,139,0.06)',
                border: '1px solid rgba(35,209,139,0.20)',
              }}
            >
              <CheckCircle2 className="w-7 h-7" style={{ color: 'var(--accent-green)' }} />
              <p className="text-xs font-semibold" style={{ color: 'var(--accent-green)' }}>
                No tampering detected
              </p>
              <p className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
                Audio appears authentic
              </p>
            </div>
          )}

          {/* Summary */}
          <div
            className="flex items-start gap-3 p-3 rounded-lg"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
          >
            <FileText className="w-4 h-4 shrink-0 mt-px" style={{ color: 'var(--accent-blue)' }} />
            <div>
              <p className="text-[10px] font-mono font-semibold uppercase tracking-widest mb-1"
                 style={{ color: 'var(--text-muted)' }}>
                Summary
              </p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {results.summary}
              </p>
            </div>
          </div>

          {/* Export */}
          <button
            className="btn-secondary w-full justify-center gap-1.5 text-xs py-2"
            onClick={() => notify('info', 'Forensic PDF report export coming soon.')}
          >
            <Download className="w-3.5 h-3.5" />
            Export Forensic Report
          </button>
        </div>
      )}

      {!hasAudio && (
        <p className="text-center text-[10.5px]" style={{ color: 'var(--text-disabled)' }}>
          Upload an audio file to run forensic analysis
        </p>
      )}
    </div>
  );
};

export default ForensicsPanel;
