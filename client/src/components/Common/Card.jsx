// ─────────────────────────────────────────────────────────────
//  Card
//  Props:
//    title       {string?}                   — card header text
//    subtitle    {string?}                   — smaller text under title
//    icon        {ReactNode?}                — icon beside title
//    accent      {'blue'|'green'|'red'|'yellow'|'violet'|'rose'|'none'}
//                colored left border strip (default 'none')
//    padding     {'none'|'sm'|'md'|'lg'}    — inner padding (default 'md')
//    shadow      {'none'|'sm'|'md'}         — drop shadow (default 'sm')
//    hoverable   {boolean}                  — lift on hover
//    headerRight {ReactNode?}               — content pinned to header right
//    footer      {ReactNode?}               — sticky footer inside card
//    children    {ReactNode}
//    className   {string?}
// ─────────────────────────────────────────────────────────────

// ── Accent left-border colors ───────────────────────────────
const ACCENT_BORDER = {
  none:   '',
  blue:   'border-l-4 border-l-blue-500',
  green:  'border-l-4 border-l-emerald-500',
  red:    'border-l-4 border-l-red-500',
  yellow: 'border-l-4 border-l-yellow-400',
  violet: 'border-l-4 border-l-violet-500',
  rose:   'border-l-4 border-l-rose-500',
};

// ── Accent icon bubble backgrounds ──────────────────────────
const ACCENT_ICON_BG = {
  none:   'bg-slate-100  text-slate-500',
  blue:   'bg-blue-100   text-blue-600',
  green:  'bg-emerald-100 text-emerald-600',
  red:    'bg-red-100    text-red-600',
  yellow: 'bg-yellow-100 text-yellow-600',
  violet: 'bg-violet-100 text-violet-600',
  rose:   'bg-rose-100   text-rose-600',
};

// ── Padding ─────────────────────────────────────────────────
const PADDING = {
  none: 'p-0',
  sm:   'p-3',
  md:   'p-5',
  lg:   'p-7',
};

// ── Shadow ──────────────────────────────────────────────────
const SHADOW = {
  none: '',
  sm:   'shadow-sm',
  md:   'shadow-md',
};

// ─────────────────────────────────────────────────────────────
//  Sub-component — card header
// ─────────────────────────────────────────────────────────────
const CardHeader = ({ title, subtitle, icon, accent = 'none', headerRight }) => {
  if (!title && !icon && !headerRight) return null;

  const iconBg = ACCENT_ICON_BG[accent] ?? ACCENT_ICON_BG.none;

  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="flex items-start gap-3 min-w-0">
        {/* Icon bubble */}
        {icon && (
          <div className={`
            flex items-center justify-center w-9 h-9 rounded-xl shrink-0
            text-base ${iconBg}
          `}>
            {icon}
          </div>
        )}

        {/* Title + subtitle */}
        <div className="min-w-0">
          {title && (
            <h3 className="text-base font-semibold text-slate-800 leading-tight">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-xs text-slate-400 mt-0.5 leading-snug">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Pinned right content */}
      {headerRight && (
        <div className="shrink-0">{headerRight}</div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
//  Main component
// ─────────────────────────────────────────────────────────────
const Card = ({
  title,
  subtitle,
  icon,
  accent      = 'none',
  padding     = 'md',
  shadow      = 'sm',
  hoverable   = false,
  headerRight,
  footer,
  children,
  className   = '',
}) => {
  const accentBorder = ACCENT_BORDER[accent]   ?? '';
  const pad          = PADDING[padding]         ?? PADDING.md;
  const sh           = SHADOW[shadow]           ?? SHADOW.sm;

  return (
    <div
      className={`
        relative bg-white border border-slate-200 rounded-2xl overflow-hidden
        ${accentBorder}
        ${sh}
        ${hoverable
          ? 'transition-all duration-250 hover:-translate-y-0.5 hover:shadow-md hover:border-slate-300 cursor-pointer'
          : ''}
        ${className}
      `}
    >
      {/* ── Body ─────────────────────────────────────────── */}
      <div className={`${pad} ${footer ? 'pb-0' : ''}`}>
        <CardHeader
          title={title}
          subtitle={subtitle}
          icon={icon}
          accent={accent}
          headerRight={headerRight}
        />
        {children}
      </div>

      {/* ── Optional sticky footer ──────────────────────── */}
      {footer && (
        <div className={`
          ${pad} pt-3 mt-3
          border-t border-slate-100 bg-slate-50/60
        `}>
          {footer}
        </div>
      )}
    </div>
  );
};

export default Card;