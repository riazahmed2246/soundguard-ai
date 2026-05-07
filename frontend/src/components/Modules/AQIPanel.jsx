import React, { useState, useCallback } from 'react';
import { Activity, Download, RefreshCw } from 'lucide-react';
import { calculateAQI } from '../../services/api';
import { useAudio } from '../../context/AudioContext';

// ─── Score ring SVG ───────────────────────────────────────────────────────────
const ScoreRing = ({ score }) => {
  const r = 46, circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const color =
    score >= 71 ? 'var(--accent-green)' :
    score >= 41 ? 'var(--accent-amber)' :
                  'var(--accent-red)';

  return (
    <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
      <svg width={120} height={120} className="-rotate-90" style={{ position: 'absolute' }}>
        <circle cx={60} cy={60} r={r} fill="none"
                stroke="var(--bg-overlay)" strokeWidth={7} />
        <circle cx={60} cy={60} r={r} fill="none"
                stroke={color} strokeWidth={7}
                strokeDasharray={`${filled} ${circ - filled}`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 0.6s var(--ease-snap), stroke 0.4s' }} />
      </svg>
      <div className="flex flex-col items-center z-10">
        <span className="font-mono text-2xl font-bold leading-none"
              style={{ color, fontFamily: 'var(--font-mono)' }}>
          {score.toFixed(0)}
        </span>
        <span className="text-[9px] font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>
          / 100
        </span>
      </div>
    </div>
  );
};

// ─── Metric bar row ───────────────────────────────────────────────────────────
const MetricBar = ({ label, value, max, unit = '', fillColor = 'var(--accent-blue)', inverted = false }) => {
  const pct = Math.min(100, Math.max(0, inverted
    ? (1 - value / max) * 100
    : (value / max) * 100));

  const barColor =
    pct >= 70 ? 'var(--accent-green)' :
    pct >= 40 ? 'var(--accent-amber)' :
                'var(--accent-red)';

  return (
    <div className="py-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <div className="flex justify-between items-center mb-1.5">
        <span className="mono-label">{label}</span>
        <span className="font-mono text-[11px] font-semibold"
              style={{ color: barColor }}>
          {value}{unit}
        </span>
      </div>
      <div className="progress-track" style={{ height: 4 }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: barColor,
            transition: 'width 0.5s var(--ease-snap)',
          }}
        />
      </div>
    </div>
  );
};

// ─── Gradient quality meter ───────────────────────────────────────────────────
const QualityMeter = ({ score }) => {
  const pos = Math.min(98, Math.max(2, score));
  return (
    <div className="px-3">
      <div className="relative h-2.5 rounded-full overflow-visible"
           style={{ background: 'linear-gradient(to right, var(--accent-red), var(--accent-amber) 40%, var(--accent-green))' }}>
        {/* Pointer */}
        <div
          className="absolute -top-1 w-1 rounded-full"
          style={{
            left: `${pos}%`,
            height: 16,
            background: '#fff',
            boxShadow: '0 0 4px rgba(0,0,0,0.6)',
            transform: 'translateX(-50%)',
            transition: 'left 0.5s var(--ease-snap)',
          }}
        />
      </div>
      <div className="flex justify-between mt-1.5">
        {['Poor', 'Fair', 'Good'].map((l) => (
          <span key={l} className="text-[9px] font-mono" style={{ color: 'var(--text-disabled)' }}>{l}</span>
        ))}
      </div>
    </div>
  );
};

// ─── Status badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    Good: 'badge-good',
    Fair: 'badge-fair',
    Poor: 'badge-poor',
  };
  return <span className={`badge ${map[status] ?? 'badge-neutral'}`}>{status} Quality</span>;
};

// ─── AQIPanel ─────────────────────────────────────────────────────────────────
const AQIPanel = () => {
  const {
    audioId, hasAudio,
    aqiResults, setAqiResults,
    startProcessing, updateProgress, finishProcessing, failProcessing,
    notify,
  } = useAudio();

  const [results,  setResults]  = useState(aqiResults);
  const [running,  setRunning]  = useState(false);

  const handleCalculate = useCallback(async () => {
    if (!audioId) return;
    setRunning(true);
    startProcessing('Calculating Audio Quality Index…');

    let pct = 5;
    const ticker = setInterval(() => {
      pct = Math.min(pct + 12, 88);
      updateProgress(pct,
        pct < 30 ? 'Analysing SNR…'    :
        pct < 55 ? 'Measuring clarity…' :
        pct < 75 ? 'Checking distortion…' : 'Computing score…');
    }, 350);

    try {
      const response = await calculateAQI(audioId);
      clearInterval(ticker);
      finishProcessing();
      setResults(response);
      setAqiResults(response);
      notify('success', `AQI: ${response.overall_score} — ${response.status} quality`);
    } catch (err) {
      clearInterval(ticker);
      failProcessing(err.message);
      notify('error', `AQI failed: ${err.message}`);
    } finally {
      setRunning(false);
    }
  }, [audioId, startProcessing, updateProgress, finishProcessing, failProcessing, setAqiResults, notify]);

  return (
    <div className="flex flex-col gap-4 p-3">

      {/* Calculate / Re-calculate button */}
      <button
        onClick={handleCalculate}
        disabled={!hasAudio || running}
        className="btn-primary w-full justify-center gap-2 py-2.5 text-sm"
        style={{ opacity: (!hasAudio || running) ? 0.45 : 1 }}
      >
        <Activity className="w-4 h-4" />
        <span>{running ? 'Calculating…' : results ? 'Re-calculate AQI' : 'Calculate AQI'}</span>
      </button>

      {/* Results */}
      {results && (
        <div className="flex flex-col gap-4 animate-slide-in-up">

          {/* Score ring + status */}
          <div
            className="flex flex-col items-center gap-3 py-4 rounded-xl"
            style={{ background: 'var(--bg-base)', border: '1px solid var(--border-default)' }}
          >
            <ScoreRing score={results.overall_score} />
            <StatusBadge status={results.status} />
          </div>

          {/* Gradient meter */}
          <div
            className="py-3 rounded-lg"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
          >
            <QualityMeter score={results.overall_score} />
          </div>

          {/* Metric bars */}
          <div
            className="rounded-lg overflow-hidden"
            style={{ border: '1px solid var(--border-default)' }}
          >
            <div
              className="px-3 py-2 flex items-center justify-between"
              style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)' }}
            >
              <span className="section-header" style={{ padding: 0, border: 'none' }}>
                Detailed Metrics
              </span>
            </div>

            <div className="px-3" style={{ background: 'var(--bg-surface)' }}>
              <MetricBar label="SNR"            value={results.metrics.snr}           max={60}  unit=" dB" />
              <MetricBar label="Clarity"         value={results.metrics.clarity}        max={100} unit="%" />
              <MetricBar label="Distortion"      value={results.metrics.distortion}     max={5}   unit="%" inverted />
              <MetricBar label="Dynamic Range"   value={results.metrics.dynamic_range}  max={80}  unit=" dB" />
              <MetricBar label="Noise Floor"     value={Math.abs(results.metrics.noise_floor)} max={80} unit=" dBFS" />

              {/* Frequency response – text only */}
              <div className="flex justify-between items-center py-2">
                <span className="mono-label">Freq Response</span>
                <span className={`badge ${
                  results.metrics.frequency_response === 'Excellent' ? 'badge-good' :
                  results.metrics.frequency_response === 'Good'      ? 'badge-info' :
                  results.metrics.frequency_response === 'Fair'      ? 'badge-fair' : 'badge-poor'
                }`}>
                  {results.metrics.frequency_response}
                </span>
              </div>
            </div>
          </div>

          {/* Action row */}
          <button
            className="btn-secondary w-full justify-center gap-1.5 text-xs py-2"
            onClick={() => notify('info', 'PDF report export coming soon.')}
          >
            <Download className="w-3.5 h-3.5" />
            Export Report
          </button>
        </div>
      )}

      {!hasAudio && (
        <p className="text-center text-[10.5px]" style={{ color: 'var(--text-disabled)' }}>
          Upload an audio file to calculate quality metrics
        </p>
      )}
    </div>
  );
};

export default AQIPanel;
