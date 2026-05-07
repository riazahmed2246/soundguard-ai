import React, { useState, useCallback } from 'react';
import { Wand2, Download, RotateCcw, Zap, Cpu, Layers } from 'lucide-react';
import { enhanceAudio } from '../../services/api';
import { useAudio } from '../../context/AudioContext';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const MODELS = [
  { id:'cleanunet',  label:'CleanUNet',   sub:'Real-time speech denoising',       icon:Zap    },
  { id:'demucs',     label:'DEMUCS',      sub:'Music source separation',           icon:Layers },
  { id:'fullsubnet', label:'FullSubNet+', sub:'Advanced attention-based enhance',  icon:Cpu    },
];
const MODES   = [{ id:'fast',label:'⚡ Fast'},{ id:'balanced',label:'⚖ Balanced'},{ id:'quality',label:'✦ Quality'}];
const FORMATS = ['wav','flac','mp3','ogg','aac','m4a'];

const ModelCard = ({ id, label, sub, icon: Icon, selected, onSelect }) => (
  <button onClick={() => onSelect(id)}
    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left"
    style={{ background: selected ? 'rgba(77,143,255,0.12)' : 'var(--bg-base)',
             border: `1px solid ${selected ? 'rgba(77,143,255,0.35)' : 'var(--border-subtle)'}`,
             boxShadow: selected ? 'var(--glow-blue)' : 'none' }}>
    <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
         style={{ background: selected ? 'rgba(77,143,255,0.20)' : 'var(--bg-overlay)',
                  border: `1px solid ${selected ? 'rgba(77,143,255,0.3)' : 'var(--border-subtle)'}` }}>
      <Icon className="w-3.5 h-3.5" style={{ color: selected ? 'var(--accent-blue)' : 'var(--text-muted)' }} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-xs font-semibold truncate"
           style={{ color: selected ? 'var(--accent-blue)' : 'var(--text-primary)' }}>{label}</div>
      <div className="text-[10px] truncate" style={{ color:'var(--text-muted)' }}>{sub}</div>
    </div>
    <div className="w-3 h-3 rounded-full border-2 shrink-0"
         style={{ borderColor: selected ? 'var(--accent-blue)' : 'var(--border-strong)',
                  backgroundColor: selected ? 'var(--accent-blue)' : 'transparent' }} />
  </button>
);

const Toggle = ({ value, onChange, label }) => (
  <div className="flex items-center justify-between px-3 py-2.5 rounded-lg"
       style={{ background:'var(--bg-base)', border:'1px solid var(--border-subtle)' }}>
    <span className="text-xs" style={{ color:'var(--text-secondary)' }}>{label}</span>
    <button onClick={() => onChange(!value)} className="relative shrink-0" style={{ width:36, height:20 }}>
      <div className="absolute inset-0 rounded-full transition-colors duration-200"
           style={{ background: value ? 'var(--accent-blue)' : 'var(--bg-overlay)',
                    border: `1px solid ${value ? 'var(--accent-blue)' : 'var(--border-strong)'}` }} />
      <div className="absolute top-0.5 rounded-full bg-white transition-all duration-200"
           style={{ width:16, height:16, left: value ? 18 : 2 }} />
    </button>
  </div>
);

const MetricRow = ({ label, value, color='var(--accent-green)' }) => (
  <div className="flex items-center justify-between py-1.5"
       style={{ borderBottom:'1px solid var(--border-subtle)' }}>
    <span className="mono-label">{label}</span>
    <span className="font-mono text-xs font-semibold" style={{ color }}>{value}</span>
  </div>
);

const EnhancementPanel = () => {
  const {
    audioId, hasAudio,
    startProcessing, updateProgress, finishProcessing, failProcessing,
    setEnhancementResults, setEnhancedAudioUrl, notify,
  } = useAudio();

  const [model,          setModel]          = useState('cleanunet');
  const [noiseReduction, setNoiseReduction] = useState(80);
  const [preserveSpeech, setPreserveSpeech] = useState(true);
  const [mode,           setMode]           = useState('balanced');
  const [exportFormat,   setExportFormat]   = useState('wav');
  const [results,        setResults]        = useState(null);
  const [running,        setRunning]        = useState(false);

  const handleEnhance = useCallback(async () => {
    if (!audioId) return;
    setRunning(true); setResults(null);
    startProcessing(`Enhancing with ${MODELS.find(m => m.id === model)?.label}…`);

    let pct = 5;
    const ticker = setInterval(() => {
      pct = Math.min(pct + 8, 88);
      updateProgress(pct, pct < 50 ? 'Analysing spectrum…' : 'Applying model…');
    }, 400);

    try {
      const response = await enhanceAudio(audioId, {
        model, noise_reduction: noiseReduction / 100, preserve_speech: preserveSpeech, mode,
      });
      clearInterval(ticker); finishProcessing();
      setResults(response); setEnhancementResults(response);
      setEnhancedAudioUrl(`${BASE_URL}${response.enhanced_url}`);
      notify('success', `Enhancement complete — SNR +${response.metrics.snr_improvement} dB`);
    } catch (err) {
      clearInterval(ticker); failProcessing(err.message);
      notify('error', `Enhancement failed: ${err.message}`);
    } finally { setRunning(false); }
  }, [audioId, model, noiseReduction, preserveSpeech, mode,
      startProcessing, updateProgress, finishProcessing, failProcessing,
      setEnhancementResults, setEnhancedAudioUrl, notify]);

  const handleDownload = useCallback(() => {
    if (!results?.audio_id) return;
    window.open(`${BASE_URL}/api/enhance/${results.audio_id}/download?format=${exportFormat}`, '_blank');
  }, [results, exportFormat]);

  const handleReset = useCallback(() => {
    setModel('cleanunet'); setNoiseReduction(80); setPreserveSpeech(true);
    setMode('balanced'); setResults(null); setExportFormat('wav');
  }, []);

  return (
    <div className="flex flex-col gap-4 p-3 stagger-children">
      {/* Model */}
      <div>
        <p className="section-header" style={{ padding:'0 0 8px', border:'none' }}>Enhancement Model</p>
        <div className="flex flex-col gap-1.5">
          {MODELS.map(m => <ModelCard key={m.id} {...m} selected={model===m.id} onSelect={setModel} />)}
        </div>
      </div>

      {/* Noise reduction slider */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-medium" style={{ color:'var(--text-secondary)' }}>Noise Reduction</span>
          <span className="font-mono text-xs" style={{ color:'var(--accent-blue)' }}>{noiseReduction}%</span>
        </div>
        <input type="range" min="0" max="100" value={noiseReduction}
               onChange={e => setNoiseReduction(parseInt(e.target.value))}
               className="slider-track"
               style={{ background:`linear-gradient(to right, var(--accent-blue) 0%, var(--accent-blue) ${noiseReduction}%, var(--bg-overlay) ${noiseReduction}%, var(--bg-overlay) 100%)` }} />
        <div className="flex justify-between mt-1">
          {['Subtle','Moderate','Aggressive'].map(l => (
            <span key={l} className="text-[9px] font-mono" style={{ color:'var(--text-disabled)' }}>{l}</span>
          ))}
        </div>
      </div>

      <Toggle label="Preserve Speech Clarity" value={preserveSpeech} onChange={setPreserveSpeech} />

      {/* Mode */}
      <div>
        <p className="text-[11px] font-medium mb-2" style={{ color:'var(--text-secondary)' }}>Processing Mode</p>
        <div className="flex gap-1.5">
          {MODES.map(m => (
            <button key={m.id} onClick={() => setMode(m.id)}
              className="flex-1 py-1.5 text-[11px] font-medium rounded transition-all"
              style={{ background: mode===m.id ? 'var(--accent-blue)' : 'var(--bg-base)',
                       color: mode===m.id ? '#fff' : 'var(--text-muted)',
                       border:`1px solid ${mode===m.id ? 'var(--accent-blue)' : 'var(--border-subtle)'}` }}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <button onClick={handleEnhance} disabled={!hasAudio || running}
              className="btn-primary w-full justify-center gap-2 py-2.5 text-sm"
              style={{ opacity:(!hasAudio||running) ? 0.45 : 1 }}>
        <Wand2 className="w-4 h-4" />
        <span>{running ? 'Processing…' : 'Enhance Audio'}</span>
      </button>

      {results && (
        <div className="rounded-lg overflow-hidden animate-slide-in-up"
             style={{ border:'1px solid var(--border-default)' }}>
          <div className="flex items-center justify-between px-3 py-2"
               style={{ background:'var(--bg-elevated)', borderBottom:'1px solid var(--border-subtle)' }}>
            <span className="text-[10px] font-mono font-semibold uppercase tracking-widest"
                  style={{ color:'var(--text-muted)' }}>Results</span>
            <span className="badge badge-good">Enhanced</span>
          </div>
          <div className="px-3 py-1" style={{ background:'var(--bg-surface)' }}>
            <MetricRow label="Noise Reduced"   value={`${results.metrics.noise_reduced} dB`} />
            <MetricRow label="SNR Improvement" value={`+${results.metrics.snr_improvement} dB`} />
            <MetricRow label="Clarity"         value={`+${results.metrics.clarity_improvement}%`} />
            <MetricRow label="Processing Time" value={`${results.metrics.processing_time}s`}
                       color="var(--text-secondary)" />
          </div>

          {/* Export format selector */}
          <div className="px-3 pt-3 pb-1" style={{ background:'var(--bg-elevated)' }}>
            <p className="text-[10px] font-mono uppercase tracking-widest mb-2"
               style={{ color:'var(--text-muted)' }}>Export Format</p>
            <div className="grid grid-cols-6 gap-1 mb-3">
              {FORMATS.map(f => (
                <button key={f} onClick={() => setExportFormat(f)}
                  className="py-1 text-[10px] font-mono rounded transition-all"
                  style={{ background: exportFormat===f ? 'var(--accent-blue)' : 'var(--bg-base)',
                           color: exportFormat===f ? '#fff' : 'var(--text-muted)',
                           border:`1px solid ${exportFormat===f ? 'var(--accent-blue)' : 'var(--border-subtle)'}` }}>
                  .{f}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 px-3 pb-3" style={{ background:'var(--bg-elevated)' }}>
            <button onClick={handleDownload}
              className="btn flex-1 justify-center gap-1.5 text-xs py-2"
              style={{ background:'rgba(35,209,139,0.12)', color:'var(--accent-green)',
                       border:'1px solid rgba(35,209,139,0.25)' }}>
              <Download className="w-3.5 h-3.5" />
              Download .{exportFormat}
            </button>
            <button onClick={handleReset} className="btn-secondary flex-1 justify-center gap-1.5 text-xs py-2">
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>
        </div>
      )}

      {!hasAudio && (
        <p className="text-center text-[10.5px]" style={{ color:'var(--text-disabled)' }}>
          Upload an audio file to enable enhancement
        </p>
      )}
    </div>
  );
};

export default EnhancementPanel;
