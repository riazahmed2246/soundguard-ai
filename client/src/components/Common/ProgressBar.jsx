// ─────────────────────────────────────────────────────────────
//  ProgressBar
//  Props:
//    value       {number}   0–100
//    label       {string?}  optional left label
//    color       {'blue'|'green'|'red'|'yellow'|'auto'}
//                'auto' picks color based on value (red→yellow→green)
//    size        {'sm'|'md'|'lg'}  bar height
//    showPercent {boolean}  show % text on the right (default true)
//    showValue   {boolean}  show value inside the bar fill when wide enough
//    animated    {boolean}  pulse animation while < 100 (default false)
//    striped     {boolean}  diagonal stripe texture (default false)
// ─────────────────────────────────────────────────────────────

// ── Color maps — track bg, fill bg, text color ──────────────
const COLOR_MAP = {
  blue: {
    track: 'bg-blue-100',
    fill:  'bg-blue-500',
    text:  'text-blue-700',
    glow:  'shadow-blue-300',
  },
  green: {
    track: 'bg-emerald-100',
    fill:  'bg-emerald-500',
    text:  'text-emerald-700',
    glow:  'shadow-emerald-300',
  },
  red: {
    track: 'bg-red-100',
    fill:  'bg-red-500',
    text:  'text-red-700',
    glow:  'shadow-red-300',
  },
  yellow: {
    track: 'bg-yellow-100',
    fill:  'bg-yellow-400',
    text:  'text-yellow-700',
    glow:  'shadow-yellow-200',
  },
  violet: {
    track: 'bg-violet-100',
    fill:  'bg-violet-500',
    text:  'text-violet-700',
    glow:  'shadow-violet-300',
  },
};

// ── Height per size ─────────────────────────────────────────
const HEIGHT = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
};

// ── Auto-color based on value ───────────────────────────────
const autoColor = (value) => {
  if (value >= 71) return 'green';
  if (value >= 41) return 'yellow';
  return 'red';
};

// ─────────────────────────────────────────────────────────────
//  Main component
// ─────────────────────────────────────────────────────────────
const ProgressBar = ({
  value       = 0,
  label,
  color       = 'blue',
  size        = 'md',
  showPercent = true,
  showValue   = false,
  animated    = false,
  striped     = false,
  className   = '',
}) => {
  // Clamp value to [0, 100]
  const clamped = Math.min(100, Math.max(0, value));

  // Resolve 'auto' → actual color key
  const resolvedColor = color === 'auto' ? autoColor(clamped) : (color in COLOR_MAP ? color : 'blue');
  const c = COLOR_MAP[resolvedColor];

  const isComplete = clamped === 100;
  const height     = HEIGHT[size] ?? HEIGHT.md;

  return (
    <div className={`w-full ${className}`}>
      {/* ── Header row: label + percentage ─────────────────── */}
      {(label || showPercent) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && (
            <span className="text-sm font-medium text-slate-600 leading-none">
              {label}
            </span>
          )}
          {showPercent && (
            <span className={`text-xs font-bold tabular-nums leading-none ${c.text}`}>
              {clamped}%
            </span>
          )}
        </div>
      )}

      {/* ── Track ───────────────────────────────────────────── */}
      <div
        className={`relative w-full ${height} ${c.track} rounded-full overflow-hidden`}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? `Progress: ${clamped}%`}
      >
        {/* ── Fill ────────────────────────────────────────── */}
        <div
          className={`
            absolute inset-y-0 left-0 rounded-full
            ${c.fill}
            ${isComplete ? '' : 'transition-[width] duration-500 ease-out'}
            ${animated && !isComplete ? 'animate-pulse' : ''}
          `}
          style={{
            width: `${clamped}%`,
            // Subtle glow on the right edge of the fill
            boxShadow: clamped > 5 ? `2px 0 8px 0 var(--tw-shadow-color, rgba(0,0,0,0.15))` : 'none',
          }}
        >
          {/* Stripe texture overlay */}
          {striped && (
            <div
              className="absolute inset-0 rounded-full opacity-20"
              style={{
                backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.6) 4px, rgba(255,255,255,0.6) 8px)',
              }}
            />
          )}

          {/* Value text inside bar (only shown in 'lg' size and when fill is wide enough) */}
          {showValue && size === 'lg' && clamped > 12 && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white leading-none">
              {clamped}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProgressBar;