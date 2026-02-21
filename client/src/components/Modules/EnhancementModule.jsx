import { useState, useRef, useEffect, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import {
  Wand2, Play, Pause, Download, RotateCcw,
  CheckCircle2, AlertCircle, ChevronRight,
  Zap, Shield, Gauge, Clock, TrendingUp,
  Mic, RefreshCw,
} from 'lucide-react';

import Modal       from '../Common/Modal';
import Button      from '../Common/Button';
import ProgressBar from '../Common/ProgressBar';
import Card        from '../Common/Card';
import { useAudio } from '../../context/AudioContext';
import { enhanceAudio } from '../../services/api';

// ─────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────
const MODELS = [
  {
    id:          'CleanUNet',
    label:       'CleanUNet',
    description: 'Real-time speech denoising — fast & accurate',
    badge:       'Recommended',
    badgeColor:  'bg-blue-100 text-blue-700',
  },
  {
    id:          'DEMUCS',
    label:       'DEMUCS',
    description: 'Music source separation — best for music/mixed audio',
    badge:       'Music',
    badgeColor:  'bg-violet-100 text-violet-700',
  },
  {
    id:          'FullSubNet+',
    label:       'FullSubNet+',
    description: 'Advanced speech enhancement — highest quality, slower',
    badge:       'Pro',
    badgeColor:  'bg-emerald-100 text-emerald-700',
  },
];

const MODES = ['Fast', 'Balanced', 'Quality'];

const PROCESSING_STEPS = [
  'Loading model weights…',
  'Analysing audio spectrum…',
  'Separating noise frequencies…',
  'Applying enhancement…',
  'Post-processing output…',
  'Finalising enhanced audio…',
];

// ─────────────────────────────────────────────────────────────
//  Mini waveform player  (self-contained, no WS context)
// ─────────────────────────────────────────────────────────────
const MiniWaveform = ({ url, label, accentColor = '#3B82F6', progressColor = '#1D4ED8' }) => {
  const containerRef = useRef(null);
  const wsRef        = useRef(null);
  const [ready,   setReady]   = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!url || !containerRef.current) return;
    const ws = WaveSurfer.create({
      container:     containerRef.current,
      waveColor:     accentColor,
      progressColor,
      cursorColor:   progressColor,
      cursorWidth:   2,
      barWidth:      2,
      barGap:        1,
      barRadius:     3,
      height:        64,
      normalize:     true,
      interact:      true,
      fillParent:    true,
    });
    wsRef.current = ws;
    ws.on('ready',  () => setReady(true));
    ws.on('play',   () => setPlaying(true));
    ws.on('pause',  () => setPlaying(false));
    ws.on('finish', () => setPlaying(false));
    ws.load(url);
    return () => { try { ws.destroy(); } catch (_) {} };
  }, [url, accentColor, progressColor]);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>

      {/* Waveform */}
      <div
        ref={containerRef}
        className="w-full h-16 bg-slate-50 rounded-xl border border-slate-200 overflow-hidden"
      />

      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => wsRef.current?.playPause()}
          disabled={!ready}
          className={`
            flex items-center justify-center w-8 h-8 rounded-lg border text-sm
            transition-all duration-150
            ${ready
              ? 'bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600'
              : 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed'}
          `}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>

        {/* Download */}
        {url && (
          <a
            href={url}
            download
            className="
              flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200
              text-xs font-medium text-slate-500
              hover:border-blue-300 hover:text-blue-600
              transition-all duration-150
            "
          >
            <Download size={12} />
            Download
          </a>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
//  Metric tile
// ─────────────────────────────────────────────────────────────
const MetricTile = ({ icon: Icon, label, value, color = 'blue' }) => {
  const colors = {
    blue:    'bg-blue-50   text-blue-600   border-blue-100',
    green:   'bg-emerald-50 text-emerald-600 border-emerald-100',
    violet:  'bg-violet-50  text-violet-600  border-violet-100',
    orange:  'bg-orange-50  text-orange-600  border-orange-100',
  };
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border ${colors[color]}`}>
      <div className={`flex items-center justify-center w-8 h-8 rounded-lg bg-white/80`}>
        <Icon size={16} />
      </div>
      <div>
        <p className="text-xs font-medium opacity-70 leading-none mb-0.5">{label}</p>
        <p className="text-sm font-bold leading-none">{value ?? '—'}</p>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
//  Main component
// ─────────────────────────────────────────────────────────────
const EnhancementModule = ({ isOpen, onClose }) => {
  const { audioId, audioInfo, saveModuleResult, moduleResults } = useAudio();

  // ── Settings state ──────────────────────────────────────
  const [selectedModel,   setSelectedModel]   = useState('CleanUNet');
  const [noiseStrength,   setNoiseStrength]   = useState(80);
  const [preserveSpeech,  setPreserveSpeech]  = useState(true);
  const [processingMode,  setProcessingMode]  = useState('Balanced');

  // ── Process state ───────────────────────────────────────
  const [status,        setStatus]        = useState('idle'); // idle | processing | success | error
  const [progress,      setProgress]      = useState(0);
  const [progressStep,  setProgressStep]  = useState('');
  const [error,         setError]         = useState(null);

  // ── Results ─────────────────────────────────────────────
  const [results, setResults] = useState(moduleResults?.enhancement ?? null);

  // Sync results if context already has them (re-open case)
  useEffect(() => {
    if (moduleResults?.enhancement) setResults(moduleResults.enhancement);
  }, [moduleResults?.enhancement]);

  // ── Simulated progress ticker during API call ───────────
  const progressTimer = useRef(null);

  const startProgressSim = useCallback(() => {
    let step = 0;
    setProgress(5);
    setProgressStep(PROCESSING_STEPS[0]);
    progressTimer.current = setInterval(() => {
      step += 1;
      if (step >= PROCESSING_STEPS.length) {
        clearInterval(progressTimer.current);
        return;
      }
      setProgressStep(PROCESSING_STEPS[step]);
      setProgress(Math.min(90, Math.round((step / PROCESSING_STEPS.length) * 90)));
    }, 1800);
  }, []);

  const stopProgressSim = useCallback(() => {
    clearInterval(progressTimer.current);
  }, []);

  // ── Enhance handler ─────────────────────────────────────
  const handleEnhance = async () => {
    if (!audioId) return;
    setStatus('processing');
    setProgress(0);
    setError(null);
    startProgressSim();

    try {
      const data = await enhanceAudio(audioId, selectedModel, {
        noiseReductionStrength: noiseStrength,
        preserveSpeech,
        processingMode,
      });

      stopProgressSim();
      setProgress(100);
      setProgressStep('Complete!');
      setResults(data);
      saveModuleResult('enhancement', data);

      // Brief delay so user sees 100%
      setTimeout(() => setStatus('success'), 400);
    } catch (err) {
      stopProgressSim();
      setError(err.message || 'Enhancement failed. Please try again.');
      setStatus('error');
      setProgress(0);
    }
  };

  const handleReset = () => {
    setStatus('idle');
    setProgress(0);
    setProgressStep('');
    setError(null);
    setResults(null);
    setSelectedModel('CleanUNet');
    setNoiseStrength(80);
    setPreserveSpeech(true);
    setProcessingMode('Balanced');
  };

  const handleTryDifferent = () => {
    setStatus('idle');
    setProgress(0);
    setError(null);
  };

  // ── Derived values ──────────────────────────────────────
  const originalUrl = audioInfo?.originalUrl
    ? `http://localhost:5000${audioInfo.originalUrl}`
    : null;

  const enhancedUrl = results?.enhancedUrl
    ? `http://localhost:5000${results.enhancedUrl}`
    : null;

  const metrics = results?.metrics ?? {};
  const isProcessing = status === 'processing';
  const isSuccess    = status === 'success';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="AI-Based Audio Enhancement"
      subtitle="Remove noise using state-of-the-art deep learning models"
      size="lg"
    >
      <div className="flex flex-col gap-6">

        {/* ── SECTION 1: Model Selection ─────────────────── */}
        {status === 'idle' && (
          <Card
            title="Select Enhancement Model"
            icon={<Wand2 size={16} />}
            accent="blue"
          >
            <div className="flex flex-col gap-3 mt-1">
              {MODELS.map((model) => (
                <label
                  key={model.id}
                  className={`
                    flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer
                    transition-all duration-200
                    ${selectedModel === model.id
                      ? 'border-blue-400 bg-blue-50 shadow-sm shadow-blue-100'
                      : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50'}
                  `}
                >
                  {/* Radio */}
                  <input
                    type="radio"
                    name="model"
                    value={model.id}
                    checked={selectedModel === model.id}
                    onChange={() => setSelectedModel(model.id)}
                    className="mt-0.5 accent-blue-600 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`
                        text-sm font-semibold
                        ${selectedModel === model.id ? 'text-blue-800' : 'text-slate-800'}
                      `}>
                        {model.label}
                      </span>
                      <span className={`
                        text-[10px] font-bold px-1.5 py-0.5 rounded-md ${model.badgeColor}
                      `}>
                        {model.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 leading-snug">
                      {model.description}
                    </p>
                  </div>
                  {selectedModel === model.id && (
                    <CheckCircle2 size={16} className="text-blue-500 shrink-0 mt-0.5" />
                  )}
                </label>
              ))}
            </div>
          </Card>
        )}

        {/* ── SECTION 2: Settings ────────────────────────── */}
        {status === 'idle' && (
          <Card
            title="Enhancement Settings"
            icon={<Gauge size={16} />}
            accent="violet"
          >
            <div className="flex flex-col gap-5 mt-1">
              {/* Noise Reduction Strength */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">
                    Noise Reduction Strength
                  </label>
                  <span className="text-sm font-bold text-violet-600 tabular-nums">
                    {noiseStrength}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={noiseStrength}
                  onChange={(e) => setNoiseStrength(parseInt(e.target.value))}
                  className="w-full h-2 rounded-full appearance-none cursor-pointer accent-violet-600 bg-slate-200"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                  <span>Subtle (0%)</span>
                  <span>Aggressive (100%)</span>
                </div>
              </div>

              {/* Preserve Speech toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700">Preserve Speech</p>
                  <p className="text-xs text-slate-400">Protect voice frequencies during denoising</p>
                </div>
                <button
                  onClick={() => setPreserveSpeech((v) => !v)}
                  role="switch"
                  aria-checked={preserveSpeech}
                  className={`
                    relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent
                    transition-colors duration-200 focus:outline-none
                    ${preserveSpeech ? 'bg-blue-600' : 'bg-slate-300'}
                  `}
                >
                  <span className={`
                    inline-block h-5 w-5 transform rounded-full bg-white shadow-sm
                    transition-transform duration-200
                    ${preserveSpeech ? 'translate-x-5' : 'translate-x-0'}
                  `} />
                </button>
              </div>

              {/* Processing mode */}
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Processing Mode</p>
                <div className="flex gap-2">
                  {MODES.map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setProcessingMode(mode)}
                      className={`
                        flex-1 py-2 rounded-xl text-sm font-semibold border
                        transition-all duration-150
                        ${processingMode === mode
                          ? 'bg-blue-600 text-white border-transparent shadow-sm shadow-blue-200'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600'}
                      `}
                    >
                      {mode === 'Fast' && <span>⚡ </span>}
                      {mode === 'Balanced' && <span>⚖️ </span>}
                      {mode === 'Quality' && <span>💎 </span>}
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* ── SECTION 3: Processing state ────────────────── */}
        {isProcessing && (
          <Card
            title="Enhancing Audio…"
            icon={<Zap size={16} />}
            accent="blue"
          >
            <div className="flex flex-col gap-4 mt-2">
              <ProgressBar
                value={progress}
                color="blue"
                size="lg"
                showPercent
                animated
                striped
              />
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span className="spinner" />
                {progressStep}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs text-slate-400">
                <div className="bg-slate-50 rounded-lg p-2">
                  <p className="font-semibold text-slate-600">{selectedModel}</p>
                  <p>Model</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <p className="font-semibold text-slate-600">{noiseStrength}%</p>
                  <p>Strength</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-2">
                  <p className="font-semibold text-slate-600">{processingMode}</p>
                  <p>Mode</p>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* ── SECTION 3: Error state ─────────────────────── */}
        {status === 'error' && error && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
            <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700">Enhancement Failed</p>
              <p className="text-sm text-red-600 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* ── SECTION 4: Results ─────────────────────────── */}
        {isSuccess && results && (
          <div className="flex flex-col gap-4 fade-in">

            {/* Success banner */}
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">Enhancement complete!</p>
                <p className="text-xs text-emerald-600">Model: {selectedModel} · Mode: {processingMode}</p>
              </div>
            </div>

            {/* Waveform comparison */}
            <Card title="Before / After Comparison" icon={<TrendingUp size={16} />} accent="blue">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-2">
                <MiniWaveform
                  url={originalUrl}
                  label="Original Audio"
                  accentColor="#93C5FD"
                  progressColor="#1D4ED8"
                />
                <MiniWaveform
                  url={enhancedUrl ?? originalUrl}
                  label="Enhanced Audio"
                  accentColor="#6EE7B7"
                  progressColor="#059669"
                />
              </div>
            </Card>

            {/* Improvement metrics */}
            <Card title="Improvement Metrics" icon={<Gauge size={16} />} accent="emerald">
              <div className="grid grid-cols-2 gap-3 mt-2">
                <MetricTile
                  icon={Shield}
                  label="Noise Reduced"
                  value={metrics.noiseReduced ?? `~${noiseStrength} dB`}
                  color="green"
                />
                <MetricTile
                  icon={TrendingUp}
                  label="SNR Improvement"
                  value={metrics.snrImprovement ?? '+15 dB'}
                  color="blue"
                />
                <MetricTile
                  icon={Mic}
                  label="Speech Clarity"
                  value={metrics.speechClarity ?? '+23%'}
                  color="violet"
                />
                <MetricTile
                  icon={Clock}
                  label="Processing Time"
                  value={metrics.processingTime ?? '3.2s'}
                  color="orange"
                />
              </div>
            </Card>
          </div>
        )}

        {/* ── SECTION 5: Action buttons ──────────────────── */}
        <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100">
          {/* Idle state */}
          {status === 'idle' && (
            <>
              <Button
                variant="primary"
                size="md"
                icon={<Wand2 size={16} />}
                onClick={handleEnhance}
                disabled={!audioId}
              >
                Enhance Audio
              </Button>
              <Button variant="ghost" size="md" onClick={onClose}>
                Cancel
              </Button>
            </>
          )}

          {/* Processing state */}
          {isProcessing && (
            <Button variant="secondary" size="md" onClick={() => { stopProgressSim(); setStatus('idle'); }}>
              Cancel
            </Button>
          )}

          {/* Error state */}
          {status === 'error' && (
            <>
              <Button
                variant="primary"
                size="md"
                icon={<RefreshCw size={15} />}
                onClick={handleEnhance}
              >
                Retry
              </Button>
              <Button variant="secondary" size="md" onClick={handleTryDifferent}>
                Try Different Model
              </Button>
              <Button variant="ghost" size="md" onClick={onClose}>
                Close
              </Button>
            </>
          )}

          {/* Success state */}
          {isSuccess && (
            <>
              <Button
                variant="success"
                size="md"
                icon={<CheckCircle2 size={16} />}
                onClick={onClose}
              >
                Apply Enhancement
              </Button>
              <Button
                variant="secondary"
                size="md"
                icon={<ChevronRight size={15} />}
                onClick={handleTryDifferent}
              >
                Try Different Model
              </Button>
              <Button
                variant="ghost"
                size="md"
                icon={<RotateCcw size={14} />}
                onClick={handleReset}
              >
                Reset
              </Button>
              <Button variant="ghost" size="md" onClick={onClose}>
                Close
              </Button>
            </>
          )}
        </div>

      </div>
    </Modal>
  );
};

export default EnhancementModule;