import {
  FileAudio2,
  Clock,
  FileType2,
  Activity,
  AudioLines,
  Gauge,
  HardDrive,
  CalendarDays,
  Info,
} from 'lucide-react';
import { useAudio } from '../../context/AudioContext';

// ─────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────

/** Format a raw ISO date string into a readable local date+time */
const formatDate = (isoString) => {
  if (!isoString) return '—';
  const d = new Date(isoString);
  return d.toLocaleString(undefined, {
    year:   'numeric',
    month:  'short',
    day:    'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
};

/** Upper-case + fallback */
const fmt = (value, suffix = '') =>
  value !== null && value !== undefined ? `${value}${suffix}` : '—';

// ─────────────────────────────────────────────────────────────
//  Sub-component — single info tile
// ─────────────────────────────────────────────────────────────
const InfoTile = ({ icon: Icon, label, value, accent = false }) => (
  <div className={`
    flex items-start gap-3 p-4 rounded-xl border transition-all duration-250
    ${accent
      ? 'bg-blue-50 border-blue-200'
      : 'bg-white border-slate-200 hover:border-blue-200 hover:shadow-sm'}
  `}>
    {/* Icon bubble */}
    <div className={`
      flex items-center justify-center w-9 h-9 rounded-lg shrink-0
      ${accent ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'}
    `}>
      <Icon className="w-4.5 h-4.5" size={18} />
    </div>

    {/* Text */}
    <div className="min-w-0 flex-1">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide leading-none mb-1">
        {label}
      </p>
      <p className={`
        text-sm font-semibold leading-snug truncate
        ${accent ? 'text-blue-700' : 'text-slate-800'}
      `}>
        {value}
      </p>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────
//  Sub-component — format badge (e.g. "MP3")
// ─────────────────────────────────────────────────────────────
const FormatBadge = ({ format }) => {
  const colours = {
    mp3:  'bg-violet-100 text-violet-700 border-violet-200',
    wav:  'bg-cyan-100   text-cyan-700   border-cyan-200',
    flac: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    ogg:  'bg-orange-100 text-orange-700 border-orange-200',
    m4a:  'bg-pink-100   text-pink-700   border-pink-200',
  };
  const key   = (format || '').toLowerCase();
  const style = colours[key] || 'bg-slate-100 text-slate-600 border-slate-200';

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold border ${style}`}>
      {(format || '—').toUpperCase()}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────
//  Sub-component — processing status pills
// ─────────────────────────────────────────────────────────────
const StatusPill = ({ label, done }) => (
  <span className={`
    inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border
    ${done
      ? 'bg-green-50 text-green-700 border-green-200'
      : 'bg-slate-50 text-slate-400 border-slate-200'}
  `}>
    <span className={`w-1.5 h-1.5 rounded-full ${done ? 'bg-green-500' : 'bg-slate-300'}`} />
    {label}
  </span>
);

// ─────────────────────────────────────────────────────────────
//  Main component
// ─────────────────────────────────────────────────────────────
const AudioInfo = () => {
  const { audioInfo } = useAudio();

  // Only render when an audio file has been uploaded
  if (!audioInfo) return null;

  const {
    filename,
    format,
    duration,
    durationFormatted,
    sampleRate,
    channels,
    channelLabel,
    fileSize,
    fileSizeFormatted,
    bitrate,
    uploadDate,
    processing = {},
  } = audioInfo;

  // ── Build tile data ─────────────────────────────────────
  const tiles = [
    {
      icon:   FileAudio2,
      label:  'File Name',
      value:  filename || '—',
      accent: true,
    },
    {
      icon:  Clock,
      label: 'Duration',
      value: durationFormatted
        ? `${durationFormatted} ${duration ? `(${duration.toFixed(2)}s)` : ''}`
        : duration
          ? `${duration.toFixed(2)} s`
          : '—',
    },
    {
      icon:  FileType2,
      label: 'Format',
      // Render a coloured badge instead of plain text
      value: <FormatBadge format={format} />,
    },
    {
      icon:  Activity,
      label: 'Sample Rate',
      value: sampleRate ? `${sampleRate.toLocaleString()} Hz` : '—',
    },
    {
      icon:  AudioLines,
      label: 'Channels',
      value: channelLabel
        ? `${channelLabel}${channels ? ` (${channels}ch)` : ''}`
        : channels
          ? `${channels} channel${channels !== 1 ? 's' : ''}`
          : '—',
    },
    {
      icon:  Gauge,
      label: 'Bitrate',
      value: bitrate ? `${bitrate} kbps` : '—',
    },
    {
      icon:  HardDrive,
      label: 'File Size',
      value: fileSizeFormatted || (fileSize ? `${fileSize} B` : '—'),
    },
    {
      icon:  CalendarDays,
      label: 'Upload Date',
      value: formatDate(uploadDate),
    },
  ];

  return (
    <section className="w-full fade-in">
      {/* ── Card header ────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white">
            <Info size={15} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800 leading-tight">
              Audio Information
            </h2>
            <p className="text-xs text-slate-400">Extracted via ffprobe</p>
          </div>
        </div>

        {/* Processing status pills */}
        <div className="hidden sm:flex items-center gap-2 flex-wrap justify-end">
          <StatusPill label="Enhanced"  done={processing.enhanced}         />
          <StatusPill label="AQI"       done={processing.aqiScore != null} />
          <StatusPill label="Forensics" done={processing.authenticityScore != null} />
        </div>
      </div>

      {/* ── 2 × 4 info grid ────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map(({ icon, label, value, accent }) => (
          <InfoTile
            key={label}
            icon={icon}
            label={label}
            value={value}
            accent={accent}
          />
        ))}
      </div>

      {/* ── Mobile status pills (shown below grid on small screens) ── */}
      <div className="flex sm:hidden items-center gap-2 flex-wrap mt-3">
        <StatusPill label="Enhanced"  done={processing.enhanced}         />
        <StatusPill label="AQI"       done={processing.aqiScore != null} />
        <StatusPill label="Forensics" done={processing.authenticityScore != null} />
      </div>
    </section>
  );
};

export default AudioInfo;