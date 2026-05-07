import React, { useState, useCallback, useRef } from 'react';
import { Scissors, Waves, Volume2, Music, Download, ChevronsRight, Wind } from 'lucide-react';
import { useAudio } from '../../context/AudioContext';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ─── helpers ─────────────────────────────────────────────────────────────────
const post = async (url, body) => {
  const r = await fetch(`${BASE_URL}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    throw new Error(e.detail || `HTTP ${r.status}`);
  }
  return r;
};

const download = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

const Slider = ({ label, value, min, max, step=0.01, unit='', onChange, color='var(--accent-blue)' }) => (
  <div>
    <div className="flex justify-between mb-1">
      <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="font-mono text-xs" style={{ color }}>{value}{unit}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={e => onChange(Number(e.target.value))} className="slider-track"
      style={{ background: `linear-gradient(to right, ${color} 0%, ${color} ${((value-min)/(max-min))*100}%, var(--bg-overlay) ${((value-min)/(max-min))*100}%, var(--bg-overlay) 100%)` }} />
  </div>
);

const FmtPicker = ({ fmt, setFmt }) => {
  const fmts = ['wav','flac','mp3','ogg'];
  return (
    <div className="flex gap-1">
      {fmts.map(f => (
        <button key={f} onClick={() => setFmt(f)}
          className="flex-1 py-1 text-[10px] font-mono rounded"
          style={{ background: fmt===f ? 'var(--accent-blue)' : 'var(--bg-base)',
                   color: fmt===f ? '#fff' : 'var(--text-muted)',
                   border:`1px solid ${fmt===f ? 'var(--accent-blue)' : 'var(--border-subtle)'}` }}>
          .{f}
        </button>
      ))}
    </div>
  );
};

// ─── Tool sections ────────────────────────────────────────────────────────────
const Section = ({ title, icon: Icon, children, accent='var(--accent-blue)' }) => (
  <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-default)' }}>
    <div className="flex items-center gap-2 px-3 py-2"
         style={{ background:'var(--bg-elevated)', borderBottom:'1px solid var(--border-subtle)' }}>
      <Icon className="w-3.5 h-3.5" style={{ color: accent }} />
      <span className="text-xs font-semibold" style={{ color:'var(--text-primary)' }}>{title}</span>
    </div>
    <div className="p-3 flex flex-col gap-3" style={{ background:'var(--bg-surface)' }}>
      {children}
    </div>
  </div>
);

const RunBtn = ({ label, onClick, loading, disabled }) => (
  <button onClick={onClick} disabled={disabled || loading}
    className="btn-primary w-full justify-center gap-2 py-2 text-xs"
    style={{ opacity: (disabled || loading) ? 0.45 : 1 }}>
    {loading ? <span className="spinner" style={{ width:14, height:14 }} /> : null}
    {loading ? 'Processing…' : label}
  </button>
);

// ─── AudioEditorPanel ─────────────────────────────────────────────────────────
const AudioEditorPanel = () => {
  const { audioId, audioInfo, hasAudio, notify } = useAudio();

  // Trim state
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd,   setTrimEnd]   = useState(10);
  const [trimFmt,   setTrimFmt]   = useState('wav');
  const [trimBusy,  setTrimBusy]  = useState(false);

  // Fade state
  const [fadeIn,   setFadeIn]   = useState(0.5);
  const [fadeOut,  setFadeOut]  = useState(0.5);
  const [fadeFmt,  setFadeFmt]  = useState('wav');
  const [fadeBusy, setFadeBusy] = useState(false);

  // Gain state
  const [gainDb,    setGainDb]    = useState(0);
  const [normalize, setNormalize] = useState(false);
  const [gainFmt,   setGainFmt]   = useState('wav');
  const [gainBusy,  setGainBusy]  = useState(false);

  // Silence state
  const [silThresh, setSilThresh] = useState(-40);
  const [silFmt,    setSilFmt]    = useState('wav');
  const [silBusy,   setSilBusy]   = useState(false);

  const dur = audioInfo?.duration ?? 30;

  const run = useCallback(async (url, body, fmt, filename, setBusy) => {
    setBusy(true);
    try {
      const r    = await post(url, body);
      const blob = await r.blob();
      download(blob, filename);
      notify('success', `Download ready: ${filename}`);
    } catch (e) {
      notify('error', e.message);
    } finally {
      setBusy(false);
    }
  }, [notify]);

  if (!hasAudio) {
    return (
      <div className="flex flex-col items-center gap-3 p-6">
        <Scissors className="w-8 h-8" style={{ color:'var(--text-disabled)' }} />
        <p className="text-xs text-center" style={{ color:'var(--text-disabled)' }}>
          Upload an audio file to use the editor
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-3">

      {/* ── Trim ──────────────────────────────────────────────────────── */}
      <Section title="Trim / Crop" icon={Scissors} accent="var(--accent-blue)">
        <Slider label="Start" value={trimStart} min={0} max={Math.max(0, dur-0.1)}
                step={0.1} unit="s" onChange={v => setTrimStart(Math.min(v, trimEnd-0.1))} />
        <Slider label="End" value={trimEnd} min={0.1} max={dur}
                step={0.1} unit="s" onChange={v => setTrimEnd(Math.max(v, trimStart+0.1))}
                color="var(--accent-cyan)" />
        <p className="text-[10px] font-mono text-center" style={{ color:'var(--text-muted)' }}>
          Duration: {(trimEnd - trimStart).toFixed(1)}s
        </p>
        <FmtPicker fmt={trimFmt} setFmt={setTrimFmt} />
        <RunBtn label="Trim & Download" loading={trimBusy}
          onClick={() => run('/api/editor/trim',
            { audio_id: audioId, start_time: trimStart, end_time: trimEnd, output_format: trimFmt },
            trimFmt, `trimmed.${trimFmt}`, setTrimBusy)} />
      </Section>

      {/* ── Fade ──────────────────────────────────────────────────────── */}
      <Section title="Fade In / Out" icon={Waves} accent="var(--accent-purple)">
        <Slider label="Fade In" value={fadeIn} min={0} max={Math.min(5, dur/3)}
                step={0.1} unit="s" onChange={setFadeIn} color="var(--accent-purple)" />
        <Slider label="Fade Out" value={fadeOut} min={0} max={Math.min(5, dur/3)}
                step={0.1} unit="s" onChange={setFadeOut} color="var(--accent-red)" />
        <FmtPicker fmt={fadeFmt} setFmt={setFadeFmt} />
        <RunBtn label="Apply Fades & Download" loading={fadeBusy}
          onClick={() => run('/api/editor/fade',
            { audio_id: audioId, fade_in: fadeIn, fade_out: fadeOut, output_format: fadeFmt },
            fadeFmt, `faded.${fadeFmt}`, setFadeBusy)} />
      </Section>

      {/* ── Gain ──────────────────────────────────────────────────────── */}
      <Section title="Gain / Normalize" icon={Volume2} accent="var(--accent-amber)">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <div onClick={() => setNormalize(!normalize)}
              className="relative" style={{ width:36, height:20 }}>
              <div className="absolute inset-0 rounded-full"
                   style={{ background: normalize ? 'var(--accent-blue)' : 'var(--bg-overlay)',
                            border:`1px solid ${normalize ? 'var(--accent-blue)' : 'var(--border-strong)'}` }} />
              <div className="absolute top-0.5 rounded-full bg-white"
                   style={{ width:16, height:16, left: normalize ? 18 : 2, transition:'left 0.2s' }} />
            </div>
            <span className="text-xs" style={{ color:'var(--text-secondary)' }}>Normalize to -1 dBFS</span>
          </label>
        </div>
        {!normalize && (
          <Slider label="Gain" value={gainDb} min={-40} max={40}
                  step={0.5} unit=" dB" onChange={setGainDb} color="var(--accent-amber)" />
        )}
        <FmtPicker fmt={gainFmt} setFmt={setGainFmt} />
        <RunBtn label="Apply Gain & Download" loading={gainBusy}
          onClick={() => run('/api/editor/gain',
            { audio_id: audioId, gain_db: gainDb, normalize, output_format: gainFmt },
            gainFmt, `gain_adjusted.${gainFmt}`, setGainBusy)} />
      </Section>

      {/* ── Remove Silence ────────────────────────────────────────────── */}
      <Section title="Remove Silence" icon={ChevronsRight} accent="var(--accent-green)">
        <Slider label="Silence Threshold" value={silThresh} min={-80} max={-10}
                step={1} unit=" dB" onChange={setSilThresh} color="var(--accent-green)" />
        <FmtPicker fmt={silFmt} setFmt={setSilFmt} />
        <RunBtn label="Remove Silence & Download" loading={silBusy}
          onClick={() => run('/api/editor/remove-silence',
            { audio_id: audioId, threshold_db: silThresh, output_format: silFmt },
            silFmt, `no_silence.${silFmt}`, setSilBusy)} />
      </Section>
    </div>
  );
};

export default AudioEditorPanel;
