import React, { useState, useCallback } from 'react';
import { Music, Download, Mic, Drum, RadioTower, Layers } from 'lucide-react';
import { useAudio } from '../../context/AudioContext';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const STEMS = [
  { id:'vocals', label:'Vocals',  sub:'Speech & melody (300–3.4 kHz)',  icon:Mic,         color:'var(--accent-blue)' },
  { id:'drums',  label:'Drums',   sub:'Percussion & transients',         icon:Drum,        color:'var(--accent-red)'  },
  { id:'bass',   label:'Bass',    sub:'Low frequency (20–300 Hz)',        icon:RadioTower,  color:'var(--accent-purple)'},
  { id:'other',  label:'Other',   sub:'Residual high-mid frequencies',   icon:Layers,      color:'var(--accent-amber)'},
];

const SourceSeparationPanel = () => {
  const { audioId, hasAudio, startProcessing, updateProgress,
          finishProcessing, failProcessing, notify } = useAudio();

  const [selectedStems, setSelectedStems] = useState(['vocals','drums','bass','other']);
  const [result,        setResult]        = useState(null);
  const [running,       setRunning]       = useState(false);

  const toggleStem = id => setSelectedStems(prev =>
    prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
  );

  const handleSeparate = useCallback(async () => {
    if (!audioId || !selectedStems.length) return;
    setRunning(true);
    startProcessing('Separating audio sources…');

    let pct = 5;
    const labels = ['Analysing frequency bands…','Extracting vocals…',
                    'Isolating instruments…','Writing stems…'];
    let li = 0;
    const ticker = setInterval(() => {
      pct = Math.min(pct + 6, 88);
      updateProgress(pct, labels[Math.min(li++, labels.length-1)]);
    }, 600);

    try {
      const res = await fetch(`${BASE_URL}/api/separate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio_id: audioId, stems: selectedStems }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      clearInterval(ticker);
      finishProcessing();
      setResult(data);
      notify('success', `${Object.keys(data.stems).length} stems separated successfully`);
    } catch (e) {
      clearInterval(ticker);
      failProcessing(e.message);
      notify('error', e.message);
    } finally {
      setRunning(false);
    }
  }, [audioId, selectedStems, startProcessing, updateProgress,
      finishProcessing, failProcessing, notify]);

  return (
    <div className="flex flex-col gap-4 p-3">
      <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg"
           style={{ background:'rgba(77,143,255,0.06)', border:'1px solid rgba(77,143,255,0.18)' }}>
        <Music className="w-4 h-4 mt-0.5 shrink-0" style={{ color:'var(--accent-blue)' }} />
        <p className="text-[10.5px] leading-relaxed" style={{ color:'var(--text-secondary)' }}>
          Frequency-domain source separation into 4 independent stems.
          Each stem can be downloaded separately as WAV.
        </p>
      </div>

      {/* Stem selector */}
      <div>
        <p className="text-[11px] font-medium mb-2" style={{ color:'var(--text-secondary)' }}>
          Select Stems to Extract
        </p>
        <div className="flex flex-col gap-2">
          {STEMS.map(({ id, label, sub, icon: Icon, color }) => {
            const active = selectedStems.includes(id);
            return (
              <button key={id} onClick={() => toggleStem(id)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all"
                style={{ background: active ? `${color}14` : 'var(--bg-base)',
                         border:`1px solid ${active ? color+'55' : 'var(--border-subtle)'}` }}>
                <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                     style={{ background: active ? `${color}22` : 'var(--bg-overlay)',
                              border:`1px solid ${active ? color+'44' : 'var(--border-subtle)'}` }}>
                  <Icon className="w-3.5 h-3.5" style={{ color: active ? color : 'var(--text-muted)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold" style={{ color: active ? color : 'var(--text-primary)' }}>
                    {label}
                  </div>
                  <div className="text-[10px]" style={{ color:'var(--text-muted)' }}>{sub}</div>
                </div>
                <div className="w-3.5 h-3.5 rounded-full border-2 shrink-0"
                     style={{ borderColor: active ? color : 'var(--border-strong)',
                              background: active ? color : 'transparent' }} />
              </button>
            );
          })}
        </div>
      </div>

      <button onClick={handleSeparate}
        disabled={!hasAudio || running || !selectedStems.length}
        className="btn-primary w-full justify-center gap-2 py-2.5 text-sm"
        style={{ opacity: (!hasAudio || running || !selectedStems.length) ? 0.45 : 1 }}>
        <Music className="w-4 h-4" />
        <span>{running ? 'Separating…' : 'Separate Sources'}</span>
      </button>

      {/* Results */}
      {result && (
        <div className="flex flex-col gap-2 animate-slide-in-up">
          <p className="section-header" style={{ padding:'0 0 6px', border:'none' }}>
            Download Stems
          </p>
          {STEMS.filter(s => result.stems[s.id]).map(({ id, label, icon: Icon, color }) => (
            <a key={id}
               href={`${BASE_URL}${result.stems[id]}`}
               download={`${label.toLowerCase()}.wav`}
               className="flex items-center gap-3 px-3 py-2.5 rounded-lg no-underline transition-all"
               style={{ background:`${color}0e`, border:`1px solid ${color}33` }}>
              <Icon className="w-4 h-4 shrink-0" style={{ color }} />
              <span className="flex-1 text-xs font-semibold" style={{ color }}>{label}</span>
              <Download className="w-3.5 h-3.5" style={{ color }} />
            </a>
          ))}
          <p className="text-[10px] text-center font-mono mt-1" style={{ color:'var(--text-disabled)' }}>
            Processed in {result.processing_time}s
          </p>
        </div>
      )}

      {!hasAudio && (
        <p className="text-center text-[10.5px]" style={{ color:'var(--text-disabled)' }}>
          Upload an audio file to use source separation
        </p>
      )}
    </div>
  );
};

export default SourceSeparationPanel;
