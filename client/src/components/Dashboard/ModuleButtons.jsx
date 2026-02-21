import { useAudio } from '../../context/AudioContext';

// ─────────────────────────────────────────────────────────────
//  Module definitions
// ─────────────────────────────────────────────────────────────
const MODULES = [
  {
    id:          'enhancement',
    icon:        '🎨',
    title:       'AI-Based Audio Enhancement',
    description: 'Remove noise and enhance audio quality using deep learning',
    accentColor: 'blue',
    badge:       'DeepAI',
  },
  {
    id:          'explainability',
    icon:        '🔍',
    title:       'Explainable Noise Removal',
    description: 'See what AI removed and understand the denoising process',
    accentColor: 'violet',
    badge:       'XAI',
  },
  {
    id:          'aqi',
    icon:        '📊',
    title:       'Audio Quality Index (AQI)',
    description: 'Get real-time quality score and detailed metrics',
    accentColor: 'emerald',
    badge:       'AQI',
  },
  {
    id:          'forensics',
    icon:        '🛡️',
    title:       'Tampering Detection',
    description: 'Detect splices, edits, and audio manipulation',
    accentColor: 'rose',
    badge:       'Forensics',
  },
];

// ─────────────────────────────────────────────────────────────
//  Per-accent colour maps (Tailwind purge-safe full class names)
// ─────────────────────────────────────────────────────────────
const ACCENT = {
  blue: {
    iconBg:      'bg-blue-50   group-hover:bg-blue-100',
    badge:       'bg-blue-50   text-blue-600   border-blue-200',
    border:      'hover:border-blue-400',
    shadow:      'hover:shadow-blue-100',
    btn:         'bg-blue-600  hover:bg-blue-700  focus-visible:ring-blue-400',
    btnShadow:   'shadow-blue-200',
    dot:         'bg-blue-400',
  },
  violet: {
    iconBg:      'bg-violet-50  group-hover:bg-violet-100',
    badge:       'bg-violet-50  text-violet-600  border-violet-200',
    border:      'hover:border-violet-400',
    shadow:      'hover:shadow-violet-100',
    btn:         'bg-violet-600 hover:bg-violet-700 focus-visible:ring-violet-400',
    btnShadow:   'shadow-violet-200',
    dot:         'bg-violet-400',
  },
  emerald: {
    iconBg:      'bg-emerald-50  group-hover:bg-emerald-100',
    badge:       'bg-emerald-50  text-emerald-600  border-emerald-200',
    border:      'hover:border-emerald-400',
    shadow:      'hover:shadow-emerald-100',
    btn:         'bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-400',
    btnShadow:   'shadow-emerald-200',
    dot:         'bg-emerald-400',
  },
  rose: {
    iconBg:      'bg-rose-50   group-hover:bg-rose-100',
    badge:       'bg-rose-50   text-rose-600   border-rose-200',
    border:      'hover:border-rose-400',
    shadow:      'hover:shadow-rose-100',
    btn:         'bg-rose-600  hover:bg-rose-700  focus-visible:ring-rose-400',
    btnShadow:   'shadow-rose-200',
    dot:         'bg-rose-400',
  },
};

// ─────────────────────────────────────────────────────────────
//  Sub-component — individual module card
// ─────────────────────────────────────────────────────────────
const ModuleCard = ({ module, disabled, hasResult, onLaunch }) => {
  const ac = ACCENT[module.accentColor];

  return (
    <div
      className={`
        group relative flex flex-col bg-white rounded-2xl border transition-all duration-300
        ${disabled
          ? 'border-slate-200 opacity-60 cursor-not-allowed'
          : `border-slate-200 ${ac.border} cursor-pointer
             hover:-translate-y-1.5 hover:shadow-xl ${ac.shadow}`
        }
      `}
      title={disabled ? 'Upload audio first to unlock this module' : ''}
    >
      {/* ── Completed result dot ─────────────────────────── */}
      {hasResult && !disabled && (
        <span
          className={`absolute top-3 right-3 w-2.5 h-2.5 rounded-full ${ac.dot} shadow-sm`}
          title="Results available"
        />
      )}

      <div className="flex flex-col flex-1 p-6 gap-4">
        {/* ── Icon + badge row ────────────────────────────── */}
        <div className="flex items-start justify-between">
          {/* Emoji icon bubble */}
          <div className={`
            flex items-center justify-center w-14 h-14 rounded-2xl text-3xl
            transition-all duration-300 select-none
            ${ac.iconBg}
            ${disabled ? '' : 'group-hover:scale-110'}
          `}>
            {module.icon}
          </div>

          {/* Tech badge */}
          <span className={`
            inline-flex items-center px-2 py-0.5 rounded-lg text-[11px] font-bold
            border tracking-wide ${ac.badge}
          `}>
            {module.badge}
          </span>
        </div>

        {/* ── Text content ─────────────────────────────────── */}
        <div className="flex flex-col gap-1.5 flex-1">
          <h3 className={`
            text-base font-bold leading-snug
            ${disabled ? 'text-slate-400' : 'text-slate-800'}
          `}>
            {module.title}
          </h3>
          <p className={`
            text-sm leading-relaxed
            ${disabled ? 'text-slate-300' : 'text-slate-500'}
          `}>
            {module.description}
          </p>
        </div>

        {/* ── Launch button ─────────────────────────────────── */}
        <div className="mt-auto pt-2">
          {disabled ? (
            /* Disabled state — tooltip shown via parent title attr */
            <div className="relative group/tip">
              <button
                disabled
                className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold
                           bg-slate-100 text-slate-400 cursor-not-allowed
                           flex items-center justify-center gap-2 border border-slate-200"
                aria-label={`${module.title} — upload audio first`}
              >
                {/* Lock icon (inline SVG, no extra import needed) */}
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                Upload Audio First
              </button>

              {/* Tooltip */}
              <div className="
                absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5
                bg-slate-800 text-white text-xs rounded-lg whitespace-nowrap
                opacity-0 pointer-events-none group-hover/tip:opacity-100
                transition-opacity duration-200 z-10 shadow-lg
              ">
                Upload an audio file to unlock this module
                {/* Tooltip arrow */}
                <span className="absolute top-full left-1/2 -translate-x-1/2
                  border-4 border-transparent border-t-slate-800" />
              </div>
            </div>
          ) : (
            <button
              onClick={onLaunch}
              className={`
                w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white
                transition-all duration-200 flex items-center justify-center gap-2
                shadow-md ${ac.btnShadow} ${ac.btn}
                focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
                active:scale-[0.97]
              `}
              aria-label={`Launch ${module.title}`}
            >
              {/* Rocket icon */}
              <svg className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2l5.5-5.5"/>
                <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
                <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
                <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
              </svg>
              Launch Module
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
//  Main component
// ─────────────────────────────────────────────────────────────
const ModuleButtons = () => {
  const { audioId, openModule, moduleResults } = useAudio();
  const isDisabled = !audioId;

  return (
    <section className="w-full fade-in">
      {/* ── Section header ────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-800 text-white text-base select-none">
            ⚡
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-800 leading-tight">
              Analysis Modules
            </h2>
            <p className="text-xs text-slate-400">
              {isDisabled
                ? 'Upload an audio file to unlock all modules'
                : '4 modules available — click any card to launch'}
            </p>
          </div>
        </div>

        {/* Progress counter — how many modules have been run */}
        {!isDisabled && (
          <div className="hidden sm:flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-full px-3 py-1.5">
            {MODULES.map((m) => (
              <span
                key={m.id}
                className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                  moduleResults?.[m.id]
                    ? ACCENT[m.accentColor].dot
                    : 'bg-slate-200'
                }`}
                title={`${m.title}: ${moduleResults?.[m.id] ? 'complete' : 'not run'}`}
              />
            ))}
            <span className="text-xs text-slate-400 ml-1 font-medium">
              {MODULES.filter((m) => moduleResults?.[m.id]).length}/{MODULES.length}
            </span>
          </div>
        )}
      </div>

      {/* ── 2 × 2 card grid ────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {MODULES.map((module) => (
          <ModuleCard
            key={module.id}
            module={module}
            disabled={isDisabled}
            hasResult={!!moduleResults?.[module.id]}
            onLaunch={() => openModule(module.id)}
          />
        ))}
      </div>

      {/* ── Disabled state hint banner ────────────────────── */}
      {isDisabled && (
        <div className="mt-4 flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <span className="text-lg select-none">💡</span>
          <p className="text-sm text-amber-800">
            <span className="font-semibold">All modules are locked.</span>{' '}
            Upload an audio file using the dropzone above to unlock AI analysis.
          </p>
        </div>
      )}
    </section>
  );
};

export default ModuleButtons;