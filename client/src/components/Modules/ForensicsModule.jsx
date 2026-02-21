import { useState, useEffect } from 'react';
import {
  Shield, ShieldAlert, ShieldCheck, ShieldX,
  AlertTriangle, CheckCircle2, AlertCircle,
  Download, Clock, BarChart2, Zap,
  FileWarning, Info, RefreshCw, Activity,
  Scissors, Pencil, FileDown,
} from 'lucide-react';

import Modal       from '../Common/Modal';
import Button      from '../Common/Button';
import ProgressBar from '../Common/ProgressBar';
import Card        from '../Common/Card';
import { useAudio } from '../../context/AudioContext';
import { detectTampering } from '../../services/api';

// ─────────────────────────────────────────────────────────────
//  Score band config
// ─────────────────────────────────────────────────────────────
const getScoreBand = (score) => {
  if (score >= 86) return {
    label:      'AUTHENTIC',
    sublabel:   'No tampering detected',
    color:      'emerald',
    ShieldIcon: ShieldCheck,
    badgeBg:    'bg-emerald-50  border-emerald-300 text-emerald-800',
    iconBg:     'bg-emerald-100 text-emerald-600',
    barColor:   'green',
    ringColor:  '#16a34a',
    cardBg:     'bg-emerald-50  border-emerald-200',
  };
  if (score >= 71) return {
    label:      'SUSPICIOUS',
    sublabel:   'Minor anomalies detected',
    color:      'yellow',
    ShieldIcon: Shield,
    badgeBg:    'bg-yellow-50   border-yellow-300  text-yellow-800',
    iconBg:     'bg-yellow-100  text-yellow-600',
    barColor:   'yellow',
    ringColor:  '#ca8a04',
    cardBg:     'bg-yellow-50   border-yellow-200',
  };
  if (score >= 41) return {
    label:      'MODIFIED',
    sublabel:   'Tampering evidence found',
    color:      'orange',
    ShieldIcon: ShieldAlert,
    badgeBg:    'bg-orange-50   border-orange-300  text-orange-800',
    iconBg:     'bg-orange-100  text-orange-600',
    barColor:   'red',
    ringColor:  '#ea580c',
    cardBg:     'bg-orange-50   border-orange-200',
  };
  return {
    label:      'SEVERELY MODIFIED',
    sublabel:   'Heavy manipulation detected',
    color:      'red',
    ShieldIcon: ShieldX,
    badgeBg:    'bg-red-50      border-red-300     text-red-800',
    iconBg:     'bg-red-100     text-red-600',
    barColor:   'red',
    ringColor:  '#dc2626',
    cardBg:     'bg-red-50      border-red-200',
  };
};

// ─────────────────────────────────────────────────────────────
//  Demo data
// ─────────────────────────────────────────────────────────────
const DEMO_SCORE       = 56;
const DEMO_DURATION    = 8.0; // seconds

const DEMO_DETECTIONS = [
  {
    id:          'splice-1',
    type:        'splice',
    title:       'Splice Detected',
    location:    3.2,
    confidence:  94,
    severity:    'High',
    description: 'Abrupt frequency discontinuity at the splice boundary',
    method:      'Spectral phase analysis',
  },
  {
    id:          'edit-1',
    type:        'edit',
    title:       'Edit Detected',
    location:    5.8,
    confidence:  89,
    severity:    'Medium',
    description: 'Phase mismatch and waveform inconsistency',
    method:      'RawNet3 deep learning',
  },
];

const DEMO_SUMMARY = {
  conclusion:    'Audio appears to be edited. Two segments have been joined together.',
  detectionCount: 2,
  tamperedDuration: '1.4 seconds',
  recommendation: 'Not suitable as authentic evidence without further verification.',
  analysisMethod: 'RawNet3 Deep Learning + ENF Analysis',
  processingTime: '8.3 seconds',
  dataset:        'ASVspoof 2021',
};

// ─────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────
const formatTime = (s) => {
  if (s == null) return '—';
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1).padStart(4, '0');
  return `${m}:${sec}`;
};

const severityStyle = (severity) => {
  if (severity === 'High')   return 'bg-red-100    text-red-700    border-red-200';
  if (severity === 'Medium') return 'bg-orange-100 text-orange-700 border-orange-200';
  return                            'bg-yellow-100 text-yellow-700 border-yellow-200';
};

// ─────────────────────────────────────────────────────────────
//  Sub-component — Authenticity Score Card
// ─────────────────────────────────────────────────────────────
const AuthenticityCard = ({ score, isDemo }) => {
  const band = getScoreBand(score);
  const { ShieldIcon } = band;

  return (
    <div className={`relative rounded-2xl border-2 p-6 ${band.cardBg}`}>
      {isDemo && (
        <span className="absolute top-3 right-3 text-[9px] font-bold text-slate-400 bg-white/80 px-1.5 py-0.5 rounded">
          DEMO
        </span>
      )}

      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Shield icon */}
        <div className={`
          flex items-center justify-center w-20 h-20 rounded-2xl shrink-0
          ${band.iconBg}
        `}>
          <ShieldIcon size={40} strokeWidth={1.5} />
        </div>

        {/* Score + label */}
        <div className="flex flex-col items-center sm:items-start gap-2 flex-1">
          <div className="flex items-baseline gap-2">
            <span className={`text-6xl font-black tabular-nums leading-none`}
              style={{ color: band.ringColor }}>
              {score}
            </span>
            <span className="text-2xl font-bold text-slate-400">/100</span>
          </div>

          {/* Status badge */}
          <span className={`
            inline-flex items-center gap-1.5 px-3 py-1 rounded-full
            text-sm font-black border tracking-wide ${band.badgeBg}
          `}>
            <ShieldIcon size={14} />
            {band.label}
          </span>

          <p className="text-sm text-slate-500">{band.sublabel}</p>
        </div>

        {/* Authenticity meter vertical bar */}
        <div className="hidden sm:flex flex-col items-center gap-1 shrink-0">
          <div className="relative w-6 h-32 rounded-full overflow-hidden"
            style={{ background: 'linear-gradient(to top, #dc2626, #ea580c, #ca8a04, #16a34a)' }}>
            {/* Pointer */}
            <div
              className="absolute left-0 right-0 h-1 bg-white/90 rounded-full shadow transition-all duration-700"
              style={{ bottom: `${score}%`, transform: 'translateY(50%)' }}
            />
          </div>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Auth</p>
        </div>
      </div>

      {/* Score bar */}
      <div className="mt-4">
        <ProgressBar
          value={score}
          color={band.barColor}
          size="lg"
          showPercent
          label="Authenticity Score"
        />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
//  Sub-component — Audio Timeline
// ─────────────────────────────────────────────────────────────
const AudioTimeline = ({ detections, duration, isDemo }) => {
  const tamperedRanges = detections.map((d) => ({
    start:      Math.max(0, d.location - 0.3),
    end:        Math.min(duration, d.location + 0.7),
    type:       d.type,
  }));

  const pct = (s) => `${((s / duration) * 100).toFixed(2)}%`;

  // Build tick marks
  const ticks = [];
  for (let t = 0; t <= duration; t += duration / 4) {
    ticks.push(parseFloat(t.toFixed(1)));
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">Audio Timeline</p>
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-emerald-400 inline-block" />Authentic
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-sm bg-red-400 inline-block" />Tampered
          </span>
        </div>
      </div>

      {/* Timeline track */}
      <div className="relative">
        {/* Marker triangles above bar */}
        <div className="relative h-6 mb-1">
          {detections.map((d) => (
            <div
              key={d.id}
              className="absolute flex flex-col items-center"
              style={{ left: pct(d.location), transform: 'translateX(-50%)' }}
              title={`${d.title} @ ${formatTime(d.location)}`}
            >
              <span className="text-red-500 text-base leading-none select-none">▼</span>
              <span className="text-[9px] font-bold text-red-500 leading-none whitespace-nowrap">
                {formatTime(d.location)}
              </span>
            </div>
          ))}
        </div>

        {/* Bar */}
        <div className="relative h-8 rounded-xl overflow-hidden bg-emerald-200 border border-emerald-300">
          {/* Tampered segments */}
          {tamperedRanges.map((r, i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 bg-red-400 opacity-90"
              style={{ left: pct(r.start), width: `${((r.end - r.start) / duration) * 100}%` }}
            />
          ))}

          {/* Detection lines */}
          {detections.map((d) => (
            <div
              key={d.id}
              className="absolute top-0 bottom-0 w-0.5 bg-red-700 opacity-80"
              style={{ left: pct(d.location) }}
            />
          ))}

          {/* Hatch texture overlay on tampered regions */}
          {tamperedRanges.map((r, i) => (
            <div
              key={`hatch-${i}`}
              className="absolute top-0 bottom-0 opacity-20"
              style={{
                left: pct(r.start),
                width: `${((r.end - r.start) / duration) * 100}%`,
                backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.8) 3px, rgba(255,255,255,0.8) 6px)',
              }}
            />
          ))}
        </div>

        {/* Tick marks and labels */}
        <div className="relative h-5 mt-1">
          {ticks.map((t) => (
            <div
              key={t}
              className="absolute flex flex-col items-center"
              style={{ left: pct(t), transform: 'translateX(-50%)' }}
            >
              <div className="w-px h-2 bg-slate-300" />
              <span className="text-[10px] text-slate-400 tabular-nums leading-none">
                {formatTime(t)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {isDemo && (
        <p className="text-[11px] text-slate-400 italic text-center">
          Demo timeline — run analysis for your actual audio
        </p>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
//  Sub-component — Detection card (splice / edit)
// ─────────────────────────────────────────────────────────────
const DetectionCard = ({ detection, isDemo }) => {
  const [expanded, setExpanded] = useState(false);
  const Icon = detection.type === 'splice' ? Scissors : Pencil;

  return (
    <div className={`
      relative rounded-xl border overflow-hidden transition-all duration-200
      ${detection.type === 'splice'
        ? 'border-red-200 bg-red-50'
        : 'border-orange-200 bg-orange-50'}
      ${isDemo ? 'opacity-80' : ''}
    `}>
      {isDemo && (
        <span className="absolute top-2 right-2 text-[9px] font-bold text-slate-400 bg-white/80 px-1.5 py-0.5 rounded z-10">
          DEMO
        </span>
      )}

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <div className={`
            flex items-center justify-center w-9 h-9 rounded-xl shrink-0
            ${detection.type === 'splice' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}
          `}>
            <Icon size={17} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-slate-800">{detection.title}</p>
              <span className={`
                text-[10px] font-bold px-1.5 py-0.5 rounded border ${severityStyle(detection.severity)}
              `}>
                {detection.severity}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 leading-snug">
              {detection.description}
            </p>
          </div>
        </div>

        {/* Stat row */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          {[
            { icon: Clock,    label: 'Location',   value: `${detection.location}s` },
            { icon: Activity, label: 'Confidence', value: `${detection.confidence}%` },
            { icon: Zap,      label: 'Method',     value: detection.method },
          ].map(({ icon: I, label, value }) => (
            <div key={label} className="bg-white/60 rounded-lg p-2 text-center">
              <I size={11} className="mx-auto text-slate-400 mb-0.5" />
              <p className="text-[9px] text-slate-400 leading-none">{label}</p>
              <p className="text-xs font-semibold text-slate-700 leading-snug truncate">{value}</p>
            </div>
          ))}
        </div>

        {/* Confidence bar */}
        <div className="mt-3">
          <ProgressBar
            value={detection.confidence}
            color={detection.severity === 'High' ? 'red' : 'yellow'}
            size="sm"
            label="Detection confidence"
            showPercent
          />
        </div>

        {/* Expandable tech details */}
        <button
          onClick={() => setExpanded(v => !v)}
          className="mt-2 text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors underline underline-offset-2"
        >
          {expanded ? 'Hide details ▲' : 'Show technical details ▼'}
        </button>

        {expanded && (
          <div className="mt-2 p-3 bg-slate-800 rounded-lg text-xs font-mono text-slate-300 leading-relaxed fade-in">
            <p><span className="text-slate-500">type:</span>      {detection.type}</p>
            <p><span className="text-slate-500">timestamp:</span> {detection.location}s</p>
            <p><span className="text-slate-500">confidence:</span>{detection.confidence}%</p>
            <p><span className="text-slate-500">method:</span>    {detection.method}</p>
            <p><span className="text-slate-500">severity:</span>  {detection.severity}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
//  Sub-component — Analysis Summary Card
// ─────────────────────────────────────────────────────────────
const SummaryCard = ({ summary, isDemo }) => (
  <div className={`
    relative rounded-xl border p-4 bg-blue-50 border-blue-200
    ${isDemo ? 'opacity-80' : ''}
  `}>
    {isDemo && (
      <span className="absolute top-2 right-2 text-[9px] font-bold text-slate-400 bg-white/80 px-1.5 py-0.5 rounded">
        DEMO
      </span>
    )}

    <div className="flex items-start gap-3 mb-4">
      <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-100 text-blue-600 shrink-0">
        <Info size={17} />
      </div>
      <div>
        <p className="text-sm font-bold text-blue-800">Analysis Summary</p>
        <p className="text-xs text-blue-600 mt-0.5 leading-snug">{summary.conclusion}</p>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-2 text-center mb-4">
      {[
        { label: 'Detections',        value: summary.detectionCount },
        { label: 'Tampered Duration', value: summary.tamperedDuration },
        { label: 'Analysis Method',   value: summary.analysisMethod },
        { label: 'Processing Time',   value: summary.processingTime },
      ].map(({ label, value }) => (
        <div key={label} className="bg-white/70 rounded-lg p-2">
          <p className="text-xs font-bold text-blue-800 leading-snug">{value}</p>
          <p className="text-[10px] text-slate-500">{label}</p>
        </div>
      ))}
    </div>

    {/* Recommendation banner */}
    <div className={`
      flex items-start gap-2 px-3 py-2 rounded-lg border
      ${summary.detectionCount > 0
        ? 'bg-red-50 border-red-200'
        : 'bg-emerald-50 border-emerald-200'}
    `}>
      {summary.detectionCount > 0
        ? <FileWarning size={14} className="text-red-500 shrink-0 mt-0.5" />
        : <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
      }
      <p className={`text-xs font-semibold ${
        summary.detectionCount > 0 ? 'text-red-700' : 'text-emerald-700'
      }`}>
        {summary.recommendation}
      </p>
    </div>

    <p className="text-[10px] text-slate-400 mt-2 text-center">
      Reference dataset: {summary.dataset}
    </p>
  </div>
);

// ─────────────────────────────────────────────────────────────
//  Main component
// ─────────────────────────────────────────────────────────────
const ForensicsModule = ({ isOpen, onClose }) => {
  const { audioId, audioInfo, saveModuleResult, moduleResults } = useAudio();

  const [status,     setStatus]     = useState('idle');
  const [error,      setError]      = useState(null);
  const [score,      setScore]      = useState(DEMO_SCORE);
  const [detections, setDetections] = useState(DEMO_DETECTIONS);
  const [summary,    setSummary]    = useState(DEMO_SUMMARY);
  const [isDemo,     setIsDemo]     = useState(true);

  // Restore persisted results on re-open
  useEffect(() => {
    const saved = moduleResults?.forensics;
    if (saved) {
      setScore(saved.authenticityScore ?? DEMO_SCORE);
      setDetections(saved.detections?.length ? saved.detections : DEMO_DETECTIONS);
      setSummary(saved.summary ?? DEMO_SUMMARY);
      setIsDemo(false);
      setStatus('success');
    }
  }, [moduleResults?.forensics]);

  // ── API call ───────────────────────────────────────────
  const handleAnalyse = async () => {
    if (!audioId) return;
    setStatus('loading');
    setError(null);

    try {
      const data = await detectTampering(audioId);
      setScore(data.authenticityScore ?? DEMO_SCORE);
      setDetections(data.detections?.length ? data.detections : DEMO_DETECTIONS);
      setSummary(data.summary ?? DEMO_SUMMARY);
      setIsDemo(false);
      saveModuleResult('forensics', data);
      setStatus('success');
    } catch (err) {
      setError(err.message || 'Forensic analysis failed. Please try again.');
      setStatus('error');
    }
  };

  // ── Export timeline as SVG ─────────────────────────────
  const handleExportTimeline = () => {
    const duration = audioInfo?.duration ?? DEMO_DURATION;
    const svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="120">
  <rect width="800" height="120" fill="#f8fafc"/>
  <text x="16" y="20" font-size="12" font-weight="bold" fill="#1e293b">SoundGuard AI — Forensic Timeline</text>
  <!-- Track -->
  <rect x="16" y="35" width="768" height="40" rx="8" fill="#bbf7d0"/>
  ${detections.map(d => {
    const x = 16 + (d.location / duration) * 768;
    return `
  <rect x="${x - 20}" y="35" width="40" height="40" rx="4" fill="#fca5a5" opacity="0.9"/>
  <line x1="${x}" y1="25" x2="${x}" y2="85" stroke="#dc2626" stroke-width="1.5"/>
  <text x="${x}" y="20" font-size="9" fill="#dc2626" text-anchor="middle">${d.location}s</text>
    `;
  }).join('')}
  <!-- Timestamps -->
  <text x="16"  y="105" font-size="9" fill="#94a3b8">0:00</text>
  <text x="768" y="105" font-size="9" fill="#94a3b8" text-anchor="end">${formatTime(duration)}</text>
  <text x="400" y="105" font-size="9" fill="#94a3b8" text-anchor="middle">Score: ${score}/100</text>
</svg>`.trim();

    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'soundguard-forensic-timeline.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Download full report ───────────────────────────────
  const handleDownloadReport = () => {
    const report = {
      generated:         new Date().toISOString(),
      authenticityScore: score,
      band:              getScoreBand(score).label,
      isDemo,
      detections,
      summary,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'soundguard-forensic-report.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const isLoading  = status === 'loading';
  const isSuccess  = status === 'success';
  const showData   = isSuccess || status === 'idle' || status === 'error';
  const duration   = audioInfo?.duration ?? DEMO_DURATION;
  const band       = getScoreBand(score);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Audio Tampering Detection"
      subtitle="Forensic analysis to detect cuts, splices, and manipulation"
      size="lg"
    >
      <div className="flex flex-col gap-6">

        {/* ── SECTION 1: Action row ────────────────────────── */}
        <div className="flex items-center gap-4 flex-wrap">
          <Button
            variant="primary"
            size="md"
            loading={isLoading}
            disabled={!audioId || isLoading}
            icon={isLoading ? undefined : <Shield size={16} />}
            onClick={handleAnalyse}
          >
            {isLoading ? 'Analysing…' : isSuccess ? 'Re-run Analysis' : 'Run Forensic Analysis'}
          </Button>

          {isSuccess && !isDemo && (
            <div className={`
              flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border
              ${detections.length > 0
                ? 'text-red-700 bg-red-50 border-red-200'
                : 'text-emerald-700 bg-emerald-50 border-emerald-200'}
            `}>
              {detections.length > 0
                ? <AlertTriangle size={13} />
                : <CheckCircle2 size={13} />
              }
              {detections.length > 0
                ? `${detections.length} tampering instance${detections.length > 1 ? 's' : ''} found`
                : 'Audio is authentic'}
            </div>
          )}

          {isDemo && status === 'idle' && (
            <p className="text-xs text-slate-400 italic">
              Showing demo data — click "Run Forensic Analysis" to analyse your audio
            </p>
          )}
        </div>

        {/* ── Loading ─────────────────────────────────────── */}
        {isLoading && (
          <div className="flex flex-col items-center gap-5 py-10 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 rounded-full border-4 border-slate-200" />
              <div className="absolute inset-0 rounded-full border-4 border-t-red-500 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Shield size={24} className="text-red-500" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-700">Running Forensic Analysis</p>
              <p className="text-xs text-slate-400 mt-1">
                ENF analysis · Phase continuity · RawNet3 deep learning
              </p>
            </div>
            <ProgressBar value={70} color="red" size="md" animated className="w-52" />
          </div>
        )}

        {/* ── Error ───────────────────────────────────────── */}
        {status === 'error' && error && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
            <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-700">Analysis Failed</p>
              <p className="text-sm text-red-600 mt-0.5">{error}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCw size={13} />}
              onClick={handleAnalyse}
              className="shrink-0"
            >
              Retry
            </Button>
          </div>
        )}

        {/* ── SECTION 2: Authenticity score ───────────────── */}
        {showData && !isLoading && (
          <div className="fade-in">
            {isDemo && status !== 'error' && (
              <div className="flex justify-center mb-3">
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                  Demo Data — Run analysis to see real results
                </span>
              </div>
            )}
            <AuthenticityCard score={score} isDemo={isDemo} />
          </div>
        )}

        {/* ── SECTION 3: Timeline ─────────────────────────── */}
        {showData && !isLoading && (
          <Card
            title="Forensic Timeline"
            subtitle={`Total duration: ${formatTime(duration)}`}
            icon={<BarChart2 size={16} />}
            accent="rose"
          >
            <div className="mt-2">
              <AudioTimeline
                detections={detections}
                duration={duration}
                isDemo={isDemo}
              />
            </div>
          </Card>
        )}

        {/* ── SECTION 4: Detection cards ──────────────────── */}
        {showData && !isLoading && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-slate-800">Detection Results</h3>
              <span className={`
                text-[10px] font-bold px-2 py-0.5 rounded-full border
                ${isDemo
                  ? 'text-amber-600 bg-amber-50 border-amber-200'
                  : detections.length > 0
                    ? 'text-red-600 bg-red-50 border-red-200'
                    : 'text-emerald-600 bg-emerald-50 border-emerald-200'}
              `}>
                {isDemo ? 'Demo' : `${detections.length} detected`}
              </span>
            </div>

            {/* Splice / Edit cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {detections.map((d) => (
                <DetectionCard key={d.id} detection={d} isDemo={isDemo} />
              ))}
            </div>

            {/* Summary card */}
            <SummaryCard summary={summary} isDemo={isDemo} />
          </div>
        )}

        {/* ── SECTION 5: Action buttons ────────────────────── */}
        <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100">
          <Button
            variant="danger"
            size="md"
            icon={<Download size={15} />}
            onClick={handleDownloadReport}
            disabled={!showData}
          >
            Forensic Report
          </Button>

          <Button
            variant="secondary"
            size="md"
            icon={<FileDown size={15} />}
            onClick={handleExportTimeline}
            disabled={!showData}
          >
            Export Timeline
          </Button>

          <Button variant="ghost" size="md" onClick={onClose}>
            Close
          </Button>
        </div>

      </div>
    </Modal>
  );
};

export default ForensicsModule;