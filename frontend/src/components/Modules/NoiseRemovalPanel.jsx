import React, { useState, useCallback } from 'react';
import { Wind, Download } from 'lucide-react';
import { useAudio } from '../../context/AudioContext';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const NoiseRemovalPanel = () => {
  const { audioId, hasAudio, startProcessing, updateProgress,
          finishProcessing, failProcessing, notify,
          setEnhancedAudioUrl } = useAudio();

  const [aggressiveness, setAggressiveness]   = useState(0.75);
  const [noiseEstSecs,   setNoiseEstSecs]     = useState(0.5);
  const [result,         setResult]           = useState(null);
  const [running,        setRunning]          = useState(false);

  const handleRemove = useCallback(async () => {
    if (!audioId) return;
    setRunning(true);
    startProcessing('Removing background noise…');

    let pct = 5;
    const ticker = setInterval(() => {
      pct = Math.min(pct + 10, 88);
      updateProgress(pct, pct < 40 ? 'Estimating noise profile…'
                       : pct < 70 ? 'Applying MMSE filter…'
                       : 'Finalising…');
    }, 350);

    try {
      const res = await fetch(`${BASE_URL}/api/noise-removal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio_id: audioId,
          aggressiveness: aggressiveness,
          noise_estimate_secs: noiseEstSecs,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      clearInterval(ticker);
      finishProcessing();
      setResult(data);
      setEnhancedAudioUrl(`${BASE_URL}${data.output_url}`);
      notify('success', `Noise removed — SNR +${data.metrics.snr_improvement} dB`);
    } catch (e) {
      clearInterval(ticker);
      failProcessing(e.message);
      notify('error', e.message);
    } finally {
      setRunning(false);
    }
  }, [audioId, aggressiveness, noiseEstSecs,
      startProcessing, updateProgress, finishProcessing, failProcessing,
      notify, setEnhancedAudioUrl]);

  const MetricRow = ({ label, value, color = 'var(--accent-green)' }) => (
    <div className="flex justify-between py-1.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <span className="mono-label">{label}</span>
      <span className="font-mono text-xs font-semibold" style={{ color }}>{value}</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 p-3">
      <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg"
           style={{ background:'rgba(77,143,255,0.06)', border:'1px solid rgba(77,143,255,0.18)' }}>
        <Wind className="w-4 h-4 mt-0.5 shrink-0" style={{ color:'var(--accent-blue)' }} />
        <p className="text-[10.5px] leading-relaxed" style={{ color:'var(--text-secondary)' }}>
          Uses adaptive MMSE noise estimation. The first seconds of audio (or the
          quietest section) are used to build a noise profile, then the algorithm
          suppresses matching noise throughout the file.
        </p>
      </div>

      {/* Aggressiveness */}
      <div>
        <div className="flex justify-between mb-2">
          <span className="text-[11px] font-medium" style={{ color:'var(--text-secondary)' }}>
            Removal Strength
          </span>
          <span className="font-mono text-xs" style={{ color:'var(--accent-blue)' }}>
            {Math.round(aggressiveness * 100)}%
          </span>
        </div>
        <input type="range" min="0.1" max="1.0" step="0.05" value={aggressiveness}
          onChange={e => setAggressiveness(parseFloat(e.target.value))}
          className="slider-track"
          style={{ background:`linear-gradient(to right, var(--accent-blue) 0%, var(--accent-blue) ${(aggressiveness-0.1)/0.9*100}%, var(--bg-overlay) ${(aggressiveness-0.1)/0.9*100}%, var(--bg-overlay) 100%)` }} />
        <div className="flex justify-between mt-1">
          {['Gentle', 'Balanced', 'Aggressive'].map(l => (
            <span key={l} className="text-[9px] font-mono" style={{ color:'var(--text-disabled)' }}>{l}</span>
          ))}
        </div>
      </div>

      {/* Noise estimate window */}
      <div>
        <div className="flex justify-between mb-2">
          <span className="text-[11px] font-medium" style={{ color:'var(--text-secondary)' }}>
            Noise Profile Window
          </span>
          <span className="font-mono text-xs" style={{ color:'var(--accent-cyan)' }}>
            {noiseEstSecs.toFixed(1)}s
          </span>
        </div>
        <input type="range" min="0.1" max="3.0" step="0.1" value={noiseEstSecs}
          onChange={e => setNoiseEstSecs(parseFloat(e.target.value))}
          className="slider-track"
          style={{ background:`linear-gradient(to right, var(--accent-cyan) 0%, var(--accent-cyan) ${(noiseEstSecs-0.1)/2.9*100}%, var(--bg-overlay) ${(noiseEstSecs-0.1)/2.9*100}%, var(--bg-overlay) 100%)` }} />
      </div>

      <button onClick={handleRemove} disabled={!hasAudio || running}
        className="btn-primary w-full justify-center gap-2 py-2.5 text-sm"
        style={{ opacity: (!hasAudio || running) ? 0.45 : 1 }}>
        <Wind className="w-4 h-4" />
        <span>{running ? 'Processing…' : 'Remove Background Noise'}</span>
      </button>

      {result && (
        <div className="rounded-lg overflow-hidden animate-slide-in-up"
             style={{ border:'1px solid var(--border-default)' }}>
          <div className="flex items-center justify-between px-3 py-2"
               style={{ background:'var(--bg-elevated)', borderBottom:'1px solid var(--border-subtle)' }}>
            <span className="text-[10px] font-mono font-semibold uppercase tracking-widest"
                  style={{ color:'var(--text-muted)' }}>Noise Removal Results</span>
            <span className="badge badge-good">Done</span>
          </div>
          <div className="px-3 py-1" style={{ background:'var(--bg-surface)' }}>
            <MetricRow label="Noise Reduced"   value={`${result.metrics.noise_reduced} dB`} />
            <MetricRow label="SNR Improvement" value={`+${result.metrics.snr_improvement} dB`} />
            <MetricRow label="Clarity"         value={`+${result.metrics.clarity_improvement}%`} />
            <MetricRow label="Time"            value={`${result.metrics.processing_time}s`}
                       color="var(--text-secondary)" />
          </div>
          <div className="p-3" style={{ background:'var(--bg-elevated)' }}>
            <a href={`${BASE_URL}${result.output_url}`} download
               className="btn w-full justify-center gap-1.5 text-xs py-2"
               style={{ background:'rgba(35,209,139,0.12)', color:'var(--accent-green)',
                        border:'1px solid rgba(35,209,139,0.25)', display:'flex', alignItems:'center' }}>
              <Download className="w-3.5 h-3.5" />
              Download Denoised Audio
            </a>
          </div>
        </div>
      )}

      {!hasAudio && (
        <p className="text-center text-[10.5px]" style={{ color:'var(--text-disabled)' }}>
          Upload an audio file to use noise removal
        </p>
      )}
    </div>
  );
};

export default NoiseRemovalPanel;
