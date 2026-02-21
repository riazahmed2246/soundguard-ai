import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  UploadCloud,
  FileAudio,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useAudio } from '../../context/AudioContext';
import { uploadAudio } from '../../services/api';

// ─────────────────────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────────────────────
const ACCEPTED_FORMATS = {
  'audio/mpeg':  ['.mp3'],
  'audio/wav':   ['.wav'],
  'audio/x-wav': ['.wav'],
  'audio/flac':  ['.flac'],
  'audio/ogg':   ['.ogg'],
  'audio/mp4':   ['.m4a'],
  'audio/x-m4a': ['.m4a'],
};

const FORMAT_LABELS = ['MP3', 'WAV', 'FLAC', 'OGG', 'M4A'];
const MAX_SIZE_MB    = 50;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

// ─────────────────────────────────────────────────────────────
//  Sub-component — upload progress bar
// ─────────────────────────────────────────────────────────────
const UploadProgressBar = ({ progress }) => (
  <div className="w-full mt-4">
    <div className="flex justify-between text-xs text-slate-500 mb-1">
      <span>Uploading…</span>
      <span>{progress}%</span>
    </div>
    <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
      <div
        className="h-full bg-blue-500 rounded-full transition-all duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────
//  Sub-component — success banner
// ─────────────────────────────────────────────────────────────
const SuccessBanner = ({ filename, onReset }) => (
  <div className="flex items-center justify-between gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mt-4 fade-in">
    <div className="flex items-center gap-2 min-w-0">
      <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-medium text-green-800 truncate">{filename}</p>
        <p className="text-xs text-green-600">Uploaded successfully</p>
      </div>
    </div>
    <button
      onClick={onReset}
      className="text-xs text-green-700 hover:text-green-900 underline underline-offset-2 shrink-0 transition-colors"
    >
      Upload different file
    </button>
  </div>
);

// ─────────────────────────────────────────────────────────────
//  Sub-component — error banner
// ─────────────────────────────────────────────────────────────
const ErrorBanner = ({ message }) => (
  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mt-4 fade-in">
    <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
    <p className="text-sm text-red-700">{message}</p>
  </div>
);

// ─────────────────────────────────────────────────────────────
//  Main component
// ─────────────────────────────────────────────────────────────
const AudioUpload = () => {
  const {
    audioInfo,
    uploadProgress,
    setUploadProgress,
    handleNewFile,
    handleUploadSuccess,
    setError,
    error,
  } = useAudio();

  const [isUploading, setIsUploading] = useState(false);
  const [localError, setLocalError]   = useState(null);

  // ── Upload handler ──────────────────────────────────────
  const processUpload = useCallback(async (file) => {
    setLocalError(null);
    setError(null);
    setIsUploading(true);
    setUploadProgress(0);
    handleNewFile(file);

    try {
      const formData = new FormData();
      formData.append('audio', file);

      const data = await uploadAudio(formData, (percent) => {
        setUploadProgress(percent);
      });

      handleUploadSuccess(data.id, data);
    } catch (err) {
      const msg = err.message || 'Upload failed. Please try again.';
      setLocalError(msg);
      setError(msg);
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  }, [handleNewFile, handleUploadSuccess, setError, setUploadProgress]);

  // ── Dropzone config ─────────────────────────────────────
  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    // Handle rejections first
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      const code = rejection.errors[0]?.code;

      if (code === 'file-too-large') {
        setLocalError(`File is too large. Maximum size is ${MAX_SIZE_MB} MB.`);
      } else if (code === 'file-invalid-type') {
        setLocalError(`Unsupported format. Please upload: ${FORMAT_LABELS.join(', ')}.`);
      } else {
        setLocalError(rejection.errors[0]?.message || 'Invalid file.');
      }
      return;
    }

    if (acceptedFiles.length > 0) {
      processUpload(acceptedFiles[0]);
    }
  }, [processUpload]);

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragReject,
  } = useDropzone({
    onDrop,
    accept:    ACCEPTED_FORMATS,
    maxSize:   MAX_SIZE_BYTES,
    maxFiles:  1,
    disabled:  isUploading,
  });

  // ── Derived UI state ────────────────────────────────────
  const isSuccess = !!audioInfo && !isUploading;

  const dropzoneBorderColor = isDragReject
    ? 'border-red-400 bg-red-50'
    : isDragActive
      ? 'border-blue-500 bg-blue-50 shadow-[0_0_0_4px_rgba(59,130,246,0.15)]'
      : isSuccess
        ? 'border-green-400 bg-green-50/40'
        : 'border-blue-300 bg-white hover:border-blue-500 hover:bg-blue-50/50 hover:shadow-[0_0_0_4px_rgba(59,130,246,0.08)]';

  return (
    <section className="w-full">
      {/* ── Section title ─────────────────────────────────── */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-800">Upload Audio File</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Drag &amp; drop your audio file, or click to browse
        </p>
      </div>

      {/* ── Drop zone ─────────────────────────────────────── */}
      <div
        {...getRootProps()}
        className={`
          relative w-full min-h-[200px] rounded-2xl border-2 border-dashed
          flex flex-col items-center justify-center gap-3 px-6 py-10
          cursor-pointer select-none outline-none
          transition-all duration-250
          ${dropzoneBorderColor}
          ${isUploading ? 'pointer-events-none opacity-70' : ''}
        `}
        aria-label="Audio file upload zone"
      >
        <input {...getInputProps()} aria-label="File input" />

        {/* Icon */}
        <div className={`
          flex items-center justify-center w-16 h-16 rounded-2xl transition-colors duration-250
          ${isDragReject ? 'bg-red-100 text-red-500'
            : isDragActive ? 'bg-blue-100 text-blue-600'
            : isSuccess ? 'bg-green-100 text-green-600'
            : 'bg-slate-100 text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-500'}
        `}>
          {isUploading ? (
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          ) : isDragReject ? (
            <AlertCircle className="w-8 h-8" />
          ) : isSuccess ? (
            <FileAudio className="w-8 h-8" />
          ) : (
            <UploadCloud className="w-8 h-8" />
          )}
        </div>

        {/* Label text */}
        <div className="text-center">
          {isUploading ? (
            <p className="text-sm font-medium text-blue-600">Uploading your file…</p>
          ) : isDragReject ? (
            <p className="text-sm font-medium text-red-600">
              This file type isn't supported
            </p>
          ) : isDragActive ? (
            <p className="text-sm font-medium text-blue-600">
              Drop your audio file here
            </p>
          ) : isSuccess ? (
            <p className="text-sm font-medium text-green-700">
              File ready — scroll down to analyse
            </p>
          ) : (
            <>
              <p className="text-sm font-semibold text-slate-700">
                Drag &amp; drop your audio file here
              </p>
              <p className="text-xs text-slate-400 mt-1">
                or{' '}
                <span className="text-blue-500 font-medium underline underline-offset-2">
                  click to browse
                </span>
              </p>
            </>
          )}
        </div>

        {/* Format + size chips */}
        {!isUploading && !isSuccess && (
          <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
            {FORMAT_LABELS.map((fmt) => (
              <span
                key={fmt}
                className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-xs font-medium border border-slate-200"
              >
                {fmt}
              </span>
            ))}
            <span className="text-xs text-slate-400 ml-1">· Max {MAX_SIZE_MB} MB</span>
          </div>
        )}
      </div>

      {/* ── Upload progress bar ────────────────────────────── */}
      {isUploading && <UploadProgressBar progress={uploadProgress} />}

      {/* ── Success banner ─────────────────────────────────── */}
      {isSuccess && (
        <SuccessBanner
          filename={audioInfo.filename}
          onReset={() => {
            handleNewFile(null);
            setLocalError(null);
          }}
        />
      )}

      {/* ── Error banner ────────────────────────────────────── */}
      {localError && !isUploading && <ErrorBanner message={localError} />}
    </section>
  );
};

export default AudioUpload;