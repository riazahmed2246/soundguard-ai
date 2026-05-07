import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileAudio, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { uploadAudio } from '../../services/api';
import { useAudio } from '../../context/AudioContext';

// All supported audio MIME types
const ACCEPTED = {
  'audio/wav':          ['.wav'],
  'audio/x-wav':        ['.wav'],
  'audio/mpeg':         ['.mp3'],
  'audio/flac':         ['.flac'],
  'audio/x-flac':       ['.flac'],
  'audio/ogg':          ['.ogg'],
  'audio/mp4':          ['.m4a', '.mp4'],
  'audio/x-m4a':        ['.m4a'],
  'audio/aac':          ['.aac'],
  'audio/x-aac':        ['.aac'],
  'audio/x-ms-wma':     ['.wma'],
  'audio/aiff':         ['.aiff', '.aif'],
  'audio/x-aiff':       ['.aiff', '.aif'],
  'audio/opus':         ['.opus'],
  'audio/webm':         ['.webm'],
  'video/webm':         ['.webm'],
  'audio/3gpp':         ['.3gp'],
  'audio/amr':          ['.amr'],
  'audio/x-ape':        ['.ape'],
  'audio/x-wavpack':    ['.wv'],
  'audio/x-tta':        ['.tta'],
  'audio/x-musepack':   ['.mpc'],
  'audio/*':            [],
};

const FORMAT_LABELS = ['WAV','MP3','FLAC','OGG','M4A','AAC','WMA','AIFF','OPUS','WEBM','APE','WV','TTA','AMR'];
const MAX_SIZE = 52_428_800;
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const fmtBytes = (b) => {
  if (b < 1024) return `${b} B`;
  if (b < 1_048_576) return `${(b/1024).toFixed(1)} KB`;
  return `${(b/1_048_576).toFixed(2)} MB`;
};
const fmtDur = (s) => {
  if (!s) return '—';
  return `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;
};

const WaveIcon = ({ active = false }) => (
  <div className="flex items-end justify-center gap-px" style={{ height: 48, width: 56 }}>
    {[5,9,14,20,14,9,5,14,20,14,9,5].map((h,i) => (
      <div key={i} className={active ? 'vu-bar' : ''}
           style={{ width:3, height:h, borderRadius:2,
                    background: active ? 'var(--accent-blue)' : 'var(--border-strong)',
                    transition:'background 0.3s',
                    animationDuration: active ? `${0.7+(i%4)*0.15}s` : undefined,
                    animationDelay:    active ? `${i*0.06}s`          : undefined }} />
    ))}
  </div>
);

const ProgressRing = ({ pct }) => {
  const r=26, circ=2*Math.PI*r, dash=circ-(pct/100)*circ;
  return (
    <svg width={64} height={64} className="-rotate-90">
      <circle cx={32} cy={32} r={r} fill="none" stroke="var(--bg-overlay)" strokeWidth={4} />
      <circle cx={32} cy={32} r={r} fill="none" stroke="var(--accent-blue)" strokeWidth={4}
              strokeDasharray={circ} strokeDashoffset={dash} strokeLinecap="round"
              style={{ transition:'stroke-dashoffset 0.3s var(--ease-snap)' }} />
    </svg>
  );
};

const InfoRow = ({ label, value }) => (
  <div className="flex justify-between items-center py-1.5"
       style={{ borderBottom:'1px solid var(--border-subtle)' }}>
    <span className="mono-label">{label}</span>
    <span className="mono-value">{value}</span>
  </div>
);

const AudioUpload = () => {
  const {
    setAudioFile, setAudioId, setAudioInfo, setAudioUrl,
    startProcessing, updateProgress, finishProcessing, failProcessing,
    notify, resetAudio,
  } = useAudio();

  const [uploadPct,   setUploadPct]   = useState(0);
  const [uploading,   setUploading]   = useState(false);
  const [succeeded,   setSucceeded]   = useState(false);
  const [filePreview, setFilePreview] = useState(null);
  const [errorMsg,    setErrorMsg]    = useState(null);

  const onDrop = useCallback(async (accepted, rejected) => {
    setErrorMsg(null);
    if (rejected.length > 0) {
      const reason = rejected[0].errors[0];
      setErrorMsg(
        reason.code === 'file-too-large'    ? 'File exceeds 50 MB limit.' :
        reason.code === 'file-invalid-type' ? `Format not supported. Use: ${FORMAT_LABELS.slice(0,6).join(', ')} and more.` :
        reason.message
      );
      return;
    }
    if (!accepted.length) return;
    const file = accepted[0];
    setFilePreview({ name: file.name, size: file.size, type: file.type });
    setUploading(true); setSucceeded(false); setUploadPct(0);
    startProcessing('Uploading audio…');

    try {
      const response = await uploadAudio(file, (pct) => {
        setUploadPct(pct);
        updateProgress(pct * 0.7, pct < 100 ? 'Uploading…' : 'Analysing audio…');
      });
      for (let p = 70; p <= 100; p += 5) {
        await new Promise(r => setTimeout(r, 60));
        updateProgress(p, 'Extracting metadata…');
      }
      setAudioFile(file); setAudioId(response.id); setAudioInfo(response);
      setAudioUrl(`${BASE_URL}/uploads/${response.filename}`);
      finishProcessing(); setSucceeded(true); setUploading(false);
      notify('success', `"${response.filename}" loaded — ${fmtDur(response.duration)}`);
    } catch (err) {
      setUploading(false); setSucceeded(false);
      failProcessing(err.message); setErrorMsg(err.message);
      notify('error', err.message);
    }
  }, [setAudioFile, setAudioId, setAudioInfo, setAudioUrl,
      startProcessing, updateProgress, finishProcessing, failProcessing, notify]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop, accept: ACCEPTED, maxSize: MAX_SIZE, multiple: false, disabled: uploading,
  });

  const handleReset = (e) => {
    e.stopPropagation(); resetAudio();
    setFilePreview(null); setSucceeded(false); setErrorMsg(null); setUploadPct(0);
  };

  const borderColor =
    isDragReject ? 'var(--accent-red)'   : isDragActive  ? 'var(--accent-blue)' :
    succeeded    ? 'var(--accent-green)' : errorMsg      ? 'var(--accent-red)'  :
                   'var(--border-default)';
  const bgColor =
    isDragReject ? 'rgba(255,83,112,0.05)' : isDragActive ? 'rgba(77,143,255,0.07)' :
    succeeded    ? 'rgba(35,209,139,0.05)' : 'var(--bg-surface)';

  return (
    <div className="flex items-center justify-center h-full p-6" style={{ background: 'var(--bg-base)' }}>
      <div className="w-full max-w-xl flex flex-col gap-4 animate-fade-in">
        <div className="text-center mb-2">
          <h2 className="text-xl font-bold tracking-tight mb-1"
              style={{ fontFamily:'var(--font-display)', color:'var(--text-primary)' }}>
            Load Audio
          </h2>
          <p className="text-xs" style={{ color:'var(--text-muted)' }}>
            Drop a file or click to browse — {FORMAT_LABELS.length}+ formats supported
          </p>
        </div>

        <div {...getRootProps()} data-dropzone
          className="relative rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all duration-200 select-none"
          style={{ height:220, border:`1.5px dashed ${borderColor}`, background:bgColor, outline:'none' }}>
          <input {...getInputProps()} id="audio-upload-trigger" />

          {uploading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="relative flex items-center justify-center">
                <ProgressRing pct={uploadPct} />
                <span className="absolute font-mono text-sm font-semibold" style={{ color:'var(--accent-blue)' }}>
                  {uploadPct}%
                </span>
              </div>
              <p className="text-xs" style={{ color:'var(--text-secondary)' }}>
                {uploadPct < 100 ? 'Uploading…' : 'Processing…'}
              </p>
            </div>
          ) : succeeded ? (
            <div className="flex flex-col items-center gap-2">
              <CheckCircle2 className="w-10 h-10" style={{ color:'var(--accent-green)' }} />
              <p className="text-sm font-medium" style={{ color:'var(--accent-green)' }}>Audio Loaded</p>
              <p className="text-xs" style={{ color:'var(--text-muted)' }}>Drop a new file to replace</p>
            </div>
          ) : isDragActive && !isDragReject ? (
            <div className="flex flex-col items-center gap-3">
              <WaveIcon active />
              <p className="text-sm font-semibold" style={{ color:'var(--accent-blue)' }}>Release to load</p>
            </div>
          ) : isDragReject ? (
            <div className="flex flex-col items-center gap-2">
              <AlertCircle className="w-10 h-10" style={{ color:'var(--accent-red)' }} />
              <p className="text-sm" style={{ color:'var(--accent-red)' }}>Unsupported file type</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                     style={{ background:'var(--bg-overlay)', border:'1px solid var(--border-default)' }}>
                  <Upload className="w-7 h-7" style={{ color:'var(--accent-blue)' }} />
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center"
                     style={{ background:'var(--bg-base)', border:'1px solid var(--border-default)' }}>
                  <FileAudio className="w-3 h-3" style={{ color:'var(--text-muted)' }} />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium mb-1" style={{ color:'var(--text-primary)' }}>
                  Drag & drop audio here
                </p>
                <p className="text-xs" style={{ color:'var(--text-muted)' }}>
                  or <span style={{ color:'var(--accent-blue)', textDecoration:'underline' }}>browse files</span>
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap justify-center">
                {FORMAT_LABELS.map(f => (
                  <span key={f} className="px-2 py-0.5 rounded text-[10px] font-mono"
                        style={{ background:'var(--bg-overlay)', color:'var(--text-muted)',
                                 border:'1px solid var(--border-subtle)' }}>
                    .{f.toLowerCase()}
                  </span>
                ))}
                <span className="text-[10px] font-mono ml-1" style={{ color:'var(--text-disabled)' }}>
                  · max 50 MB
                </span>
              </div>
            </div>
          )}

          {(succeeded || filePreview) && !uploading && (
            <button onClick={handleReset} className="btn-icon absolute top-2 right-2" data-tooltip="Clear audio">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs animate-slide-in-up"
               style={{ background:'rgba(255,83,112,0.08)', border:'1px solid rgba(255,83,112,0.20)',
                        color:'var(--accent-red)' }}>
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
            <span>{errorMsg}</span>
          </div>
        )}

        {succeeded && filePreview && (
          <div className="rounded-lg overflow-hidden animate-slide-in-up"
               style={{ border:'1px solid var(--border-subtle)' }}>
            <div className="flex items-center justify-between px-3 py-2"
                 style={{ background:'var(--bg-elevated)', borderBottom:'1px solid var(--border-subtle)' }}>
              <span className="text-[10px] font-mono font-semibold uppercase tracking-widest"
                    style={{ color:'var(--text-muted)' }}>File Info</span>
              <span className="badge badge-good">Ready</span>
            </div>
            <div className="px-3 py-1" style={{ background:'var(--bg-surface)' }}>
              <InfoRow label="Name" value={filePreview.name} />
              <InfoRow label="Size" value={fmtBytes(filePreview.size)} />
              <InfoRow label="Type" value={filePreview.type || '—'} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioUpload;
