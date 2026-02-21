import { useState, useEffect } from 'react';
import {
  Search, Loader2, Download, CheckCircle2,
  AlertCircle, Mic, Radio, AudioLines,
  Activity, Clock, Percent, BarChart3,
  ShieldCheck, Zap, RefreshCw,
} from 'lucide-react';

import Modal       from '../Common/Modal';
import Button      from '../Common/Button';
import ProgressBar from '../Common/ProgressBar';
import Card        from '../Common/Card';
import { useAudio } from '../../context/AudioContext';
import { explainDenoising } from '../../services/api';

// ─────────────────────────────────────────────────────────────
//  Demo / placeholder data shown before API is called
// ─────────────────────────────────────────────────────────────
const DEMO_DETECTIONS = [
  {
    id:             'background',
    icon:           Mic,
    label:          'Background Noise',
    type:           'Traffic Sound',
    frequencyRange: '100 Hz – 500 Hz',
    timeRange:      '2.3 s – 3.1 s',
    reduction:      45,
    confidence:     94,
    color:          'red',
    accentClass:    'border-red-200 bg-red-50',
    iconClass:      'bg-red-100 text-red-600',
    barColor:       'red',
    status:         null,
  },
  {
    id:             'hiss',
    icon:           Radio,
    label:          'Electrical Hiss',
    type:           'High-freq Interference',
    frequencyRange: '8 kHz – 12 kHz',
    timeRange:      'Throughout audio',
    reduction:      80,
    confidence:     89,
    color:          'yellow',
    accentClass:    'border-yellow-200 bg-yellow-50',
    iconClass:      'bg-yellow-100 text-yellow-600',
    barColor:       'yellow',
    status:         null,
  },
  {
    id:             'speech',
    icon:           AudioLines,
    label:          'Speech Preservation',
    type:           'Voice Frequencies',
    frequencyRange: '300 Hz – 3 kHz',
    timeRange:      'Throughout audio',
    reduction:      null,
    confidence:     null,
    color:          'green',
    accentClass:    'border-emerald-200 bg-emerald-50',
    iconClass:      'bg-emerald-100 text-emerald-600',
    barColor:       'green',
    status:         '100% Preserved',
  },
];

// ─────────────────────────────────────────────────────────────
//  Sub-component — spectrogram panel
// ─────────────────────────────────────────────────────────────
const SpectrogramPanel = ({ label, src, isDemo = false, accent = 'blue' }) => {
  const accentBorder = {
    blue:  'border-blue-300',
    green: 'border-emerald-300',
  };

  return (
    <div className="flex flex-col gap-2 flex-1 min-w-0">
      {/* Label */}
      <div className="flex items-center gap-2">
        <span className={`
          text-xs font-bold uppercase tracking-widest
          ${accent === 'blue' ? 'text-blue-600' : 'text-emerald-600'}
        `}>
          {label}
        </span>
        {isDemo && (
          <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
            Demo
          </span>
        )}
      </div>

      {/* Spectrogram image / placeholder */}
      <div className={`
        relative w-full rounded-xl overflow-hidden border-2
        ${accentBorder[accent] ?? 'border-slate-200'}
        bg-[#0f172a] aspect-[2.5/1]
      `}>
        {src ? (
          <img
            src={src}
            alt={`${label} spectrogram`}
            className="w-full h-full object-fill"
          />
        ) : (
          /* SVG placeholder that looks like a real spectrogram */
          <svg
            viewBox="0 0 400 160"
            className="w-full h-full"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id={`grad-${accent}`} x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%"   stopColor="#1e3a5f" />
                <stop offset="30%"  stopColor="#1d4ed8" />
                <stop offset="60%"  stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#ef4444" />
              </linearGradient>
            </defs>

            {/* Background base */}
            <rect width="400" height="160" fill="#0f172a" />

            {/* Harmonic frequency bands */}
            {[20, 45, 70, 95, 110, 130].map((y, i) => (
              <rect
                key={i}
                x="0" y={y}
                width="400" height={i % 2 === 0 ? 8 : 4}
                fill={`url(#grad-${accent})`}
                opacity={0.15 + i * 0.07}
              />
            ))}

            {/* Speech formant blobs */}
            {[
              { x: 40,  y: 60,  w: 60,  h: 50, o: 0.6 },
              { x: 120, y: 55,  w: 80,  h: 60, o: 0.7 },
              { x: 220, y: 58,  w: 70,  h: 55, o: 0.65 },
              { x: 310, y: 62,  w: 65,  h: 48, o: 0.6 },
            ].map((b, i) => (
              <rect
                key={i}
                x={b.x} y={b.y} width={b.w} height={b.h}
                rx="4" fill={`url(#grad-${accent})`} opacity={b.o}
              />
            ))}

            {/* Noise floor line (only show on original) */}
            {accent === 'blue' && (
              <>
                <rect x="0" y="130" width="400" height="20" fill="#ef4444" opacity="0.25" />
                <rect x="90"  y="70" width="50" height="15" rx="2" fill="#ef4444" opacity="0.4" />
                <rect x="200" y="15" width="80" height="10" rx="2" fill="#f59e0b" opacity="0.5" />
              </>
            )}

            {/* Axis ticks */}
            {[0, 100, 200, 300, 400].map((x) => (
              <line key={x} x1={x} y1="155" x2={x} y2="160" stroke="#64748b" strokeWidth="1" />
            ))}

            {/* Frequency axis labels */}
            <text x="2"   y="155" fill="#64748b" fontSize="8">0</text>
            <text x="340" y="155" fill="#64748b" fontSize="8">Time (s)</text>
            <text x="2"   y="10"  fill="#64748b" fontSize="8">kHz</text>
          </svg>
        )}

        {/* Colour scale legend */}
        <div className="absolute top-2 right-2 flex flex-col items-end gap-0.5">
          <div className="w-3 h-16 rounded-sm overflow-hidden border border-white/10"
            style={{ background: 'linear-gradient(to bottom, #ef4444, #f59e0b, #1d4ed8, #0f172a)' }}
          />
          <p className="text-[9px] text-white/50 leading-none">High</p>
          <p className="text-[9px] text-white/50 leading-none mt-10">Low</p>
        </div>

        {/* Axis labels overlay */}
        <div className="absolute bottom-1 left-2 text-[9px] text-slate-500">Time (s)</div>
        <div className="absolute top-2 left-2 text-[9px] text-slate-500 rotate-0">Freq</div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
//  Sub-component — noise detection card
// ─────────────────────────────────────────────────────────────
const NoiseCard = ({ detection, isDemo }) => {
  const Icon = detection.icon;

  return (
    <div className={`
      relative rounded-xl border p-4 flex flex-col gap-3
      transition-all duration-200 hover:shadow-sm
      ${detection.accentClass}
      ${isDemo ? 'opacity-80' : ''}
    `}>
      {/* Demo watermark */}
      {isDemo && (
        <span className="absolute top-2 right-2 text-[9px] font-bold text-slate-400 bg-white/80 px-1.5 py-0.5 rounded">
          DEMO
        </span>
      )}

      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className={`flex items-center justify-center w-9 h-9 rounded-xl ${detection.iconClass}`}>
          <Icon size={17} />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-800 leading-tight">{detection.label}</p>
          <p className="text-xs text-slate-500 leading-none mt-0.5">{detection.type}</p>
        </div>
      </div>

      {/* Metadata grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        <DataRow icon={Activity}  label="Freq Range"  value={detection.frequencyRange} />
        <DataRow icon={Clock}     label="Time Range"  value={detection.timeRange} />

        {detection.status ? (
          /* Speech Preservation row */
          <div className="col-span-2 flex items-center gap-1.5 bg-white/60 rounded-lg px-2 py-1.5">
            <ShieldCheck size={13} className="text-emerald-600 shrink-0" />
            <span className="text-xs font-bold text-emerald-700">{detection.status}</span>
          </div>
        ) : (
          <>
            <DataRow icon={Percent}   label="Reduction"   value={`${detection.reduction} dB removed`} />
            <DataRow icon={BarChart3} label="Confidence"  value={`${detection.confidence}%`} />
          </>
        )}
      </div>

      {/* Confidence / preservation bar */}
      {detection.confidence != null ? (
        <ProgressBar
          value={detection.confidence}
          label="Confidence"
          color={detection.barColor}
          size="sm"
          showPercent
        />
      ) : (
        <ProgressBar
          value={100}
          label="Preservation"
          color="green"
          size="sm"
          showPercent
        />
      )}
    </div>
  );
};

const DataRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-1.5">
    <Icon size={11} className="text-slate-400 shrink-0 mt-0.5" />
    <div className="min-w-0">
      <p className="text-[10px] text-slate-400 leading-none">{label}</p>
      <p className="text-xs font-semibold text-slate-700 leading-snug truncate">{value}</p>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────
//  Main component
// ─────────────────────────────────────────────────────────────
const ExplainabilityModule = ({ isOpen, onClose }) => {
  const { audioId, saveModuleResult, moduleResults } = useAudio();

  const [status,      setStatus]      = useState('idle');   // idle | loading | success | error
  const [error,       setError]       = useState(null);
  const [results,     setResults]     = useState(null);
  const [isDemo,      setIsDemo]      = useState(true);

  // Restore persisted results if module was already run
  useEffect(() => {
    if (moduleResults?.explainability) {
      setResults(moduleResults.explainability);
      setStatus('success');
      setIsDemo(false);
    }
  }, [moduleResults?.explainability]);

  // ── API call ───────────────────────────────────────────
  const handleAnalyse = async () => {
    if (!audioId) return;
    setStatus('loading');
    setError(null);

    try {
      const data = await explainDenoising(audioId);
      setResults(data);
      setIsDemo(false);
      saveModuleResult('explainability', data);
      setStatus('success');
    } catch (err) {
      setError(err.message || 'Analysis failed. Please try again.');
      setStatus('error');
    }
  };

  // ── Derived values ─────────────────────────────────────
  const isLoading   = status === 'loading';
  const isSuccess   = status === 'success';
  const showResults = isSuccess || isDemo;

  // Resolve spectrogram images from API or show SVG placeholders
  const originalSpectrogramSrc = results?.spectrograms?.original ?? null;
  const enhancedSpectrogramSrc = results?.spectrograms?.enhanced ?? null;

  // Merge API detections over demo data
  const detections = (() => {
    if (!results?.noiseDetections?.length) return DEMO_DETECTIONS;
    // Map API response back onto the card structure
    return DEMO_DETECTIONS.map((demo, i) => ({
      ...demo,
      ...results.noiseDetections[i],
    }));
  })();

  // ── Download report ────────────────────────────────────
  const handleDownloadReport = () => {
    if (!results?.report) {
      // Fallback: generate a simple JSON blob
      const blob = new Blob(
        [JSON.stringify(results ?? { demo: true, detections: DEMO_DETECTIONS }, null, 2)],
        { type: 'application/json' }
      );
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = 'soundguard-explainability-report.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Explainable Noise Removal"
      subtitle="Understand what AI removed and why"
      size="lg"
    >
      <div className="flex flex-col gap-6">

        {/* ── SECTION 1: Analyse button / status ─────────── */}
        <div className="flex items-center gap-4 flex-wrap">
          <Button
            variant="primary"
            size="md"
            loading={isLoading}
            disabled={!audioId || isLoading}
            icon={isLoading ? undefined : <Search size={16} />}
            onClick={handleAnalyse}
          >
            {isLoading ? 'Analysing…' : isSuccess ? 'Re-Analyse' : 'Analyse & Explain'}
          </Button>

          {/* Status pill */}
          {isSuccess && !isDemo && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
              <CheckCircle2 size={13} />
              Analysis complete
            </div>
          )}

          {isDemo && status === 'idle' && (
            <p className="text-xs text-slate-400 italic">
              Showing demo data — click "Analyse &amp; Explain" to run on your audio
            </p>
          )}
        </div>

        {/* ── Loading overlay ─────────────────────────────── */}
        {isLoading && (
          <div className="flex flex-col items-center gap-4 py-8 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="relative flex items-center justify-center w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-blue-100" />
              <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 animate-spin" />
              <Search size={22} className="text-blue-500" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-700">Generating Explanations</p>
              <p className="text-xs text-slate-400 mt-1">
                Building spectrograms · Detecting noise regions · Classifying frequencies
              </p>
            </div>
            <ProgressBar value={75} color="blue" size="md" animated className="w-48" />
          </div>
        )}

        {/* ── Error banner ────────────────────────────────── */}
        {status === 'error' && error && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
            <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700">Analysis Failed</p>
              <p className="text-sm text-red-600 mt-0.5">{error}</p>
            </div>
            <Button variant="ghost" size="sm" icon={<RefreshCw size={13} />} onClick={handleAnalyse} className="ml-auto shrink-0">
              Retry
            </Button>
          </div>
        )}

        {/* ── SECTION 2: Spectrogram comparison ──────────── */}
        {!isLoading && showResults && (
          <Card
            title="Spectrogram Comparison"
            subtitle="Frequency content before and after noise removal"
            icon={<BarChart3 size={16} />}
            accent="blue"
          >
            <div className="flex flex-col sm:flex-row gap-4 mt-3">
              <SpectrogramPanel
                label="Original Audio"
                src={originalSpectrogramSrc}
                isDemo={isDemo}
                accent="blue"
              />

              {/* Arrow divider */}
              <div className="hidden sm:flex items-center self-center shrink-0">
                <div className="flex flex-col items-center gap-1 text-slate-300">
                  <Zap size={20} className="text-blue-400" />
                  <div className="w-px h-8 bg-slate-200" />
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">AI</p>
                </div>
              </div>

              <SpectrogramPanel
                label="Enhanced Audio"
                src={enhancedSpectrogramSrc}
                isDemo={isDemo}
                accent="green"
              />
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-slate-100">
              {[
                { color: 'bg-red-400',    label: 'High energy noise' },
                { color: 'bg-yellow-400', label: 'Mid-range noise' },
                { color: 'bg-blue-500',   label: 'Signal' },
                { color: 'bg-slate-800',  label: 'Silence / background' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className={`w-3 h-3 rounded-sm ${color}`} />
                  <span className="text-[11px] text-slate-500">{label}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ── SECTION 3: Noise detection cards ───────────── */}
        {!isLoading && showResults && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-base font-semibold text-slate-800">Detected Noise Components</h3>
              {isDemo && (
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  Demo Data
                </span>
              )}
              {isSuccess && !isDemo && (
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  Live Results
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {detections.map((detection) => (
                <NoiseCard
                  key={detection.id}
                  detection={detection}
                  isDemo={isDemo}
                />
              ))}
            </div>

            {/* Summary footer */}
            <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex flex-wrap gap-4 text-center">
                <div className="flex-1 min-w-[80px]">
                  <p className="text-lg font-bold text-red-600">
                    {detections.filter(d => d.reduction != null).length}
                  </p>
                  <p className="text-[11px] text-slate-500">Noise types removed</p>
                </div>
                <div className="flex-1 min-w-[80px]">
                  <p className="text-lg font-bold text-emerald-600">100%</p>
                  <p className="text-[11px] text-slate-500">Speech preserved</p>
                </div>
                <div className="flex-1 min-w-[80px]">
                  <p className="text-lg font-bold text-blue-600">
                    {Math.round(
                      detections
                        .filter(d => d.confidence != null)
                        .reduce((a, d) => a + d.confidence, 0) /
                      Math.max(1, detections.filter(d => d.confidence != null).length)
                    )}%
                  </p>
                  <p className="text-[11px] text-slate-500">Avg. confidence</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── SECTION 4: Action buttons ───────────────────── */}
        <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100">
          <Button
            variant="secondary"
            size="md"
            icon={<Download size={15} />}
            onClick={handleDownloadReport}
            disabled={!showResults}
          >
            Download Report
          </Button>

          <Button
            variant="primary"
            size="md"
            icon={<CheckCircle2 size={15} />}
            onClick={onClose}
            disabled={!isSuccess}
          >
            Apply Changes
          </Button>

          <Button
            variant="ghost"
            size="md"
            onClick={onClose}
          >
            Close
          </Button>
        </div>

      </div>
    </Modal>
  );
};

export default ExplainabilityModule;