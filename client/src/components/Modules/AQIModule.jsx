import { useState, useEffect, useRef } from 'react';
import {
  BarChart3, Radio, Zap, Activity,
  SlidersHorizontal, VolumeX, CheckCircle2,
  AlertCircle, Download, RefreshCw, TrendingUp,
} from 'lucide-react';

import Modal       from '../Common/Modal';
import Button      from '../Common/Button';
import ProgressBar from '../Common/ProgressBar';
import Card        from '../Common/Card';
import { useAudio } from '../../context/AudioContext';
import { calculateAQI } from '../../services/api';

// ─────────────────────────────────────────────────────────────
//  Constants & demo data
// ─────────────────────────────────────────────────────────────
const DEMO_AQI_SCORE = 87;

const DEMO_METRICS = [
  {
    id:       'snr',
    icon:     Radio,
    name:     'Signal-to-Noise Ratio',
    short:    'SNR',
    value:    '35.2 dB',
    rawValue: 88,          // 0-100 for the progress bar
    status:   'Good',
    statusOk: true,
  },
  {
    id:       'clarity',
    icon:     Activity,
    name:     'Clarity',
    short:    'Clarity',
    value:    '92%',
    rawValue: 92,
    status:   'Excellent',
    statusOk: true,
  },
  {
    id:       'distortion',
    icon:     Zap,
    name:     'Distortion',
    short:    'THD',
    value:    '0.3%',
    rawValue: 97,          // low distortion = high score
    status:   'Excellent',
    statusOk: true,
  },
  {
    id:       'frequency',
    icon:     SlidersHorizontal,
    name:     'Frequency Response',
    short:    'Freq',
    value:    'Excellent',
    rawValue: 91,
    status:   'Good',
    statusOk: true,
  },
  {
    id:       'dynamic',
    icon:     TrendingUp,
    name:     'Dynamic Range',
    short:    'DR',
    value:    '78 dB',
    rawValue: 78,
    status:   'Good',
    statusOk: true,
  },
  {
    id:       'noiseFloor',
    icon:     VolumeX,
    name:     'Noise Floor',
    short:    'NF',
    value:    '-65 dB',
    rawValue: 93,          // lower noise floor = higher score
    status:   'Excellent',
    statusOk: true,
  },
];

// ─────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────
const getScoreColor = (score) => {
  if (score >= 71) return { stroke: '#16a34a', text: 'text-emerald-600', label: 'Good',  bg: 'bg-emerald-50  border-emerald-200' };
  if (score >= 41) return { stroke: '#ca8a04', text: 'text-yellow-600',  label: 'Fair',  bg: 'bg-yellow-50   border-yellow-200'  };
  return               { stroke: '#dc2626', text: 'text-red-600',    label: 'Poor',  bg: 'bg-red-50     border-red-200'     };
};

const getStatusStyle = (isOk) =>
  isOk
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : 'bg-red-50     text-red-700     border-red-200';

// ─────────────────────────────────────────────────────────────
//  Sub-component: Circular AQI ring
// ─────────────────────────────────────────────────────────────
const AQIRing = ({ score, animated }) => {
  const [displayed, setDisplayed] = useState(0);
  const animRef = useRef(null);

  useEffect(() => {
    if (!animated) { setDisplayed(score); return; }

    // Count up from 0 to score over ~900ms
    let start   = null;
    const duration = 900;
    const step  = (ts) => {
      if (!start) start = ts;
      const elapsed = ts - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out-cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayed(Math.round(eased * score));
      if (progress < 1) animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animRef.current);
  }, [score, animated]);

  const SIZE       = 180;
  const STROKE     = 14;
  const RADIUS     = (SIZE - STROKE) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const offset     = CIRCUMFERENCE - (displayed / 100) * CIRCUMFERENCE;
  const { stroke, text } = getScoreColor(displayed);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg
          width={SIZE} height={SIZE}
          className="-rotate-90"
          style={{ display: 'block' }}
        >
          {/* Track ring */}
          <circle
            cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={STROKE}
          />
          {/* Score ring */}
          <circle
            cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
            fill="none"
            stroke={stroke}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.05s linear, stroke 0.4s ease' }}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <span className={`text-5xl font-black tabular-nums leading-none ${text}`}>
            {displayed}
          </span>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
            / 100
          </span>
        </div>
      </div>

      {/* Label */}
      <p className="text-sm font-semibold text-slate-600 text-center">
        Overall Audio Quality
      </p>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
//  Sub-component: Horizontal quality meter with pointer
// ─────────────────────────────────────────────────────────────
const QualityMeter = ({ score }) => {
  const { label } = getScoreColor(score);
  const pct       = Math.min(100, Math.max(0, score));

  return (
    <div className="flex flex-col gap-2">
      {/* Gradient bar */}
      <div className="relative w-full">
        <div
          className="h-4 w-full rounded-full overflow-hidden"
          style={{
            background: 'linear-gradient(to right, #dc2626 0%, #fbbf24 40%, #16a34a 70%, #15803d 100%)',
          }}
        />
        {/* Pointer triangle */}
        <div
          className="absolute -top-2 transition-all duration-700 ease-out"
          style={{ left: `calc(${pct}% - 6px)` }}
        >
          <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[8px] border-l-transparent border-r-transparent border-b-slate-800" />
        </div>
        {/* Pointer line */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-slate-800 rounded-full transition-all duration-700 ease-out"
          style={{ left: `${pct}%`, transform: 'translateX(-50%)' }}
        />
      </div>

      {/* Section labels */}
      <div className="grid grid-cols-3 text-center text-xs font-semibold">
        <span className={label === 'Poor' ? 'text-red-600' : 'text-slate-400'}>
          Poor (0–40)
        </span>
        <span className={label === 'Fair' ? 'text-yellow-600' : 'text-slate-400'}>
          Fair (41–70)
        </span>
        <span className={label === 'Good' ? 'text-emerald-600' : 'text-slate-400'}>
          Good (71–100)
        </span>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
//  Sub-component: Single metric card
// ─────────────────────────────────────────────────────────────
const MetricCard = ({ metric, isDemo }) => {
  const Icon       = metric.icon;
  const barColor   = metric.rawValue >= 71 ? 'green' : metric.rawValue >= 41 ? 'yellow' : 'red';
  const statusStyle = getStatusStyle(metric.statusOk);

  return (
    <div className={`
      relative flex flex-col gap-3 p-4 rounded-xl border bg-white
      transition-all duration-200 hover:shadow-sm hover:border-blue-200
      ${isDemo ? 'opacity-75' : ''}
    `}>
      {isDemo && (
        <span className="absolute top-2 right-2 text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
          DEMO
        </span>
      )}

      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-600 shrink-0">
          <Icon size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-400 leading-none truncate">{metric.name}</p>
          <p className="text-base font-bold text-slate-800 leading-snug tabular-nums">
            {metric.value}
          </p>
        </div>
      </div>

      {/* Status badge */}
      <span className={`
        self-start inline-flex items-center gap-1 px-2 py-0.5
        rounded-full text-[10px] font-bold border ${statusStyle}
      `}>
        <CheckCircle2 size={9} />
        {metric.status}
      </span>

      {/* Progress bar */}
      <ProgressBar
        value={metric.rawValue}
        color={barColor}
        size="sm"
        showPercent={false}
      />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
//  Main component
// ─────────────────────────────────────────────────────────────
const AQIModule = ({ isOpen, onClose }) => {
  const { audioId, saveModuleResult, moduleResults } = useAudio();

  const [status,  setStatus]  = useState('idle');   // idle | loading | success | error
  const [error,   setError]   = useState(null);
  const [score,   setScore]   = useState(DEMO_AQI_SCORE);
  const [metrics, setMetrics] = useState(DEMO_METRICS);
  const [isDemo,  setIsDemo]  = useState(true);

  // Restore persisted results on re-open
  useEffect(() => {
    const saved = moduleResults?.aqi;
    if (saved) {
      setScore(saved.aqiScore ?? DEMO_AQI_SCORE);
      if (saved.metrics) setMetrics(mergeMetrics(saved.metrics));
      setIsDemo(false);
      setStatus('success');
    }
  }, [moduleResults?.aqi]);

  // ── Merge API metrics into display structure ────────────
  const mergeMetrics = (apiMetrics) => {
    return DEMO_METRICS.map((demo) => {
      const live = apiMetrics[demo.id];
      if (!live) return demo;
      return {
        ...demo,
        value:    live.value    ?? demo.value,
        rawValue: live.rawValue ?? demo.rawValue,
        status:   live.status   ?? demo.status,
        statusOk: live.statusOk ?? demo.statusOk,
      };
    });
  };

  // ── API call ───────────────────────────────────────────
  const handleCalculate = async () => {
    if (!audioId) return;
    setStatus('loading');
    setError(null);

    try {
      const data = await calculateAQI(audioId);
      setScore(data.aqiScore ?? DEMO_AQI_SCORE);
      if (data.metrics) setMetrics(mergeMetrics(data.metrics));
      setIsDemo(false);
      saveModuleResult('aqi', data);
      setStatus('success');
    } catch (err) {
      setError(err.message || 'AQI calculation failed. Please try again.');
      setStatus('error');
    }
  };

  // ── Download report ────────────────────────────────────
  const handleDownload = () => {
    const report = {
      generated:  new Date().toISOString(),
      aqiScore:   score,
      aqiBand:    getScoreColor(score).label,
      isDemo,
      metrics:    metrics.map(({ id, name, value, status }) => ({ id, name, value, status })),
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'soundguard-aqi-report.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const isLoading  = status === 'loading';
  const isSuccess  = status === 'success';
  const showData   = isSuccess || (status === 'idle' && isDemo) || status === 'error';
  const { label: bandLabel, bg: bandBg } = getScoreColor(score);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Audio Quality Index (AQI)"
      subtitle="Real-time quality assessment with standardised metrics"
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
            icon={isLoading ? undefined : <BarChart3 size={16} />}
            onClick={handleCalculate}
          >
            {isLoading ? 'Calculating…' : isSuccess ? 'Re-calculate AQI' : 'Calculate AQI'}
          </Button>

          {isSuccess && !isDemo && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
              <CheckCircle2 size={13} />
              AQI complete
            </div>
          )}

          {isDemo && status === 'idle' && (
            <p className="text-xs text-slate-400 italic">
              Showing demo values — click "Calculate AQI" to analyse your audio
            </p>
          )}
        </div>

        {/* ── Loading ─────────────────────────────────────── */}
        {isLoading && (
          <div className="flex flex-col items-center gap-5 py-10 bg-slate-50 rounded-2xl border border-slate-200">
            {/* Spinning ring around a mini-ring placeholder */}
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 rounded-full border-4 border-slate-200" />
              <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <BarChart3 size={24} className="text-blue-500" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-700">Calculating Audio Quality</p>
              <p className="text-xs text-slate-400 mt-1">
                Measuring SNR · Clarity · Distortion · Dynamic Range
              </p>
            </div>
            <ProgressBar value={65} color="blue" size="md" animated className="w-52" />
          </div>
        )}

        {/* ── Error ───────────────────────────────────────── */}
        {status === 'error' && error && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
            <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-700">Calculation Failed</p>
              <p className="text-sm text-red-600 mt-0.5">{error}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCw size={13} />}
              onClick={handleCalculate}
              className="shrink-0"
            >
              Retry
            </Button>
          </div>
        )}

        {/* ── SECTION 2 + 3: Score + Quality Meter ────────── */}
        {showData && !isLoading && (
          <Card accent="blue">
            {/* Demo watermark */}
            {isDemo && (
              <div className="flex justify-center mb-2">
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                  Demo Data — Run "Calculate AQI" for real results
                </span>
              </div>
            )}

            {/* Score ring centered */}
            <div className="flex flex-col items-center gap-6 py-2">
              <AQIRing score={score} animated={isSuccess || isDemo} />

              {/* Band badge */}
              <span className={`
                inline-flex items-center gap-1.5 px-4 py-1.5
                rounded-full text-sm font-bold border ${bandBg}
              `}>
                <span className={`w-2 h-2 rounded-full ${
                  bandLabel === 'Good' ? 'bg-emerald-500'
                  : bandLabel === 'Fair' ? 'bg-yellow-500'
                  : 'bg-red-500'
                }`} />
                {bandLabel} Quality
              </span>

              {/* Quality meter */}
              <div className="w-full max-w-sm px-2">
                <QualityMeter score={score} />
              </div>
            </div>
          </Card>
        )}

        {/* ── SECTION 4: Metrics grid ──────────────────────── */}
        {showData && !isLoading && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-base font-semibold text-slate-800">Detailed Metrics</h3>
              <span className={`
                text-[10px] font-bold px-2 py-0.5 rounded-full border
                ${isDemo
                  ? 'text-amber-600 bg-amber-50 border-amber-200'
                  : 'text-emerald-600 bg-emerald-50 border-emerald-200'}
              `}>
                {isDemo ? 'Demo Values' : 'Live Results'}
              </span>
            </div>

            {/* 2 × 3 grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {metrics.map((metric) => (
                <MetricCard key={metric.id} metric={metric} isDemo={isDemo} />
              ))}
            </div>

            {/* Metrics summary row */}
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                {
                  count: metrics.filter(m => m.status === 'Excellent').length,
                  label: 'Excellent',
                  color: 'text-emerald-600',
                  bg:    'bg-emerald-50 border-emerald-200',
                },
                {
                  count: metrics.filter(m => m.status === 'Good').length,
                  label: 'Good',
                  color: 'text-blue-600',
                  bg:    'bg-blue-50 border-blue-200',
                },
                {
                  count: metrics.filter(m => !m.statusOk).length,
                  label: 'Warning',
                  color: 'text-red-600',
                  bg:    'bg-red-50 border-red-200',
                },
              ].map(({ count, label, color, bg }) => (
                <div key={label} className={`rounded-xl border py-2.5 px-2 ${bg}`}>
                  <p className={`text-xl font-black ${color}`}>{count}</p>
                  <p className="text-[11px] text-slate-500 font-medium">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SECTION 5: Action buttons ────────────────────── */}
        <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100">
          <Button
            variant="primary"
            size="md"
            icon={<RefreshCw size={15} />}
            onClick={handleCalculate}
            disabled={!audioId || isLoading}
          >
            Re-calculate AQI
          </Button>

          <Button
            variant="secondary"
            size="md"
            icon={<Download size={15} />}
            onClick={handleDownload}
            disabled={!showData}
          >
            Download Report
          </Button>

          <Button variant="ghost" size="md" onClick={onClose}>
            Close
          </Button>
        </div>

      </div>
    </Modal>
  );
};

export default AQIModule;