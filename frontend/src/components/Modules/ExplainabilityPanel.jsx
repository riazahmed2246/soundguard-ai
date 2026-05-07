import React, { useState, useCallback } from 'react';
import { Brain, Download, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { explainDenoising } from '../../services/api';
import { useAudio } from '../../context/AudioContext';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ─── Confidence bar ───────────────────────────────────────────────────────────
const ConfidenceBar = ({ value }) => {
  const color =
    value >= 90 ? 'var(--accent-green)' :
    value >= 70 ? 'var(--accent-blue)'  :
                  'var(--accent-amber)';
  return (
    <div className="flex items-center gap-2 mt-1.5">
      <div className="flex-1 progress-track" style={{ height: 3 }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${value}%`,
            background: color,
            transition: 'width 0.5s var(--ease-snap)',
          }}
        />
      </div>
      <span className="font-mono text-[10px] w-7 text-right" style={{ color }}>
        {value}%
      </span>
    </div>
  );
};

// ─── Noise detection card ─────────────────────────────────────────────────────
const NoiseCard = ({ det, index }) => {
  const isPreserved = det.type === 'Speech Preservation';
  const borderColor = isPreserved ? 'rgba(35,209,139,0.25)' : 'rgba(77,143,255,0.20)';
  const bgColor     = isPreserved ? 'rgba(35,209,139,0.06)' : 'rgba(77,143,255,0.06)';

  return (
    <div
      className="rounded-lg p-3 animate-slide-in-up"
      style={{
        background:       bgColor,
        border:           `1px solid ${borderColor}`,
        animationDelay:   `${index * 60}ms`,
      }}
    >
      <div className="flex items-start gap-3">
        <span className="text-xl mt-0.5">{det.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
              {det.type}
            </span>
            <span
              className={`badge ${isPreserved ? 'badge-good' : 'badge-info'}`}
              style={{ fontSize: 9 }}
            >
              {det.confidence}%
            </span>
          </div>

          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 mb-1.5">
            <span className="mono-label">Frequencies</span>
            <span className="mono-value text-right">{det.frequency_range}</span>
            <span className="mono-label">Time</span>
            <span className="mono-value text-right truncate" title={det.time_range}>
              {det.time_range}
            </span>
            <span className="mono-label">Action</span>
            <span
              className="font-mono text-[10px] text-right"
              style={{ color: isPreserved ? 'var(--accent-green)' : 'var(--accent-amber)' }}
            >
              {det.reduction}
            </span>
          </div>

          <ConfidenceBar value={det.confidence} />
        </div>
      </div>
    </div>
  );
};

// ─── Spectrogram image ────────────────────────────────────────────────────────
const SpectrogramCard = ({ url, label }) => {
  const [loaded, setLoaded] = useState(false);
  const [error,  setError]  = useState(false);

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: '1px solid var(--border-subtle)' }}
    >
      <div
        className="px-3 py-1.5 flex items-center justify-between"
        style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)' }}
      >
        <span className="section-header" style={{ padding: 0, border: 'none', fontSize: 10 }}>
          {label}
        </span>
        {loaded && (
          <CheckCircle2 className="w-3 h-3" style={{ color: 'var(--accent-green)' }} />
        )}
      </div>
      <div
        className="relative flex items-center justify-center"
        style={{ minHeight: 100, background: 'var(--bg-void)' }}
      >
        {!error ? (
          <img
            src={`${BASE_URL}${url}`}
            alt={label}
            className="w-full block"
            style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.3s' }}
            onLoad={() => setLoaded(true)}
            onError={() => setError(true)}
          />
        ) : (
          <div className="flex flex-col items-center gap-1 py-6">
            <AlertCircle className="w-5 h-5" style={{ color: 'var(--text-disabled)' }} />
            <span className="text-[10px]" style={{ color: 'var(--text-disabled)' }}>
              Image unavailable
            </span>
          </div>
        )}
        {!loaded && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="spinner" />
          </div>
        )}
      </div>
    </div>
  );
};

// ─── ExplainabilityPanel ──────────────────────────────────────────────────────
const ExplainabilityPanel = () => {
  const {
    audioId, hasAudio,
    explainabilityResults, setExplainabilityResults,
    startProcessing, updateProgress, finishProcessing, failProcessing,
    notify,
  } = useAudio();

  const [results, setResults] = useState(explainabilityResults);
  const [running, setRunning] = useState(false);

  const handleAnalyze = useCallback(async () => {
    if (!audioId) return;
    setRunning(true);
    startProcessing('Generating spectrogram analysis…');

    let pct = 5;
    const ticker = setInterval(() => {
      pct = Math.min(pct + 15, 85);
      updateProgress(pct,
        pct < 40 ? 'Computing STFT…' :
        pct < 70 ? 'Rendering spectrograms…' :
                   'Detecting noise patterns…');
    }, 400);

    try {
      const response = await explainDenoising(audioId);
      clearInterval(ticker);
      finishProcessing();
      setResults(response);
      setExplainabilityResults(response);
      const n = response.noise_detections?.length ?? 0;
      notify('success', `Explainability complete — ${n} noise pattern${n !== 1 ? 's' : ''} detected`);
    } catch (err) {
      clearInterval(ticker);
      failProcessing(err.message);
      notify('error', `Analysis failed: ${err.message}`);
    } finally {
      setRunning(false);
    }
  }, [audioId, startProcessing, updateProgress, finishProcessing, failProcessing,
      setExplainabilityResults, notify]);

  return (
    <div className="flex flex-col gap-4 p-3">

      {/* Action button */}
      <button
        onClick={handleAnalyze}
        disabled={!hasAudio || running}
        className="btn-primary w-full justify-center gap-2 py-2.5 text-sm"
        style={{ opacity: (!hasAudio || running) ? 0.45 : 1 }}
      >
        <Brain className="w-4 h-4" />
        <span>{running ? 'Analysing…' : results ? 'Re-analyse' : 'Analyse & Explain'}</span>
      </button>

      {results && (
        <div className="flex flex-col gap-4 animate-fade-in">

          {/* Spectrograms */}
          <div className="flex flex-col gap-3">
            {results.original_spectrogram && (
              <SpectrogramCard
                url={results.original_spectrogram}
                label="Original Audio"
              />
            )}
            {results.enhanced_spectrogram && (
              <SpectrogramCard
                url={results.enhanced_spectrogram}
                label="Enhanced Audio"
              />
            )}
            {!results.enhanced_spectrogram && (
              <p className="text-[10.5px] text-center py-1" style={{ color: 'var(--text-disabled)' }}>
                Run enhancement to see the before/after comparison
              </p>
            )}
          </div>

          {/* Noise detection cards */}
          {results.noise_detections?.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="section-header" style={{ padding: '0 0 6px', border: 'none' }}>
                AI Explanation
              </p>
              {results.noise_detections.map((det, i) => (
                <NoiseCard key={i} det={det} index={i} />
              ))}
            </div>
          )}

          {/* Export */}
          <button
            className="btn-secondary w-full justify-center gap-1.5 text-xs py-2"
            onClick={() => notify('info', 'PDF report export coming soon.')}
          >
            <Download className="w-3.5 h-3.5" />
            Download Report
          </button>
        </div>
      )}

      {!hasAudio && (
        <p className="text-center text-[10.5px]" style={{ color: 'var(--text-disabled)' }}>
          Upload an audio file to generate explainability analysis
        </p>
      )}
    </div>
  );
};

export default ExplainabilityPanel;
