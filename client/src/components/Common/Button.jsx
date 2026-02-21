import { Loader2 } from 'lucide-react';

// ─────────────────────────────────────────────────────────────
//  Button
//  Props:
//    variant   {'primary'|'secondary'|'danger'|'ghost'|'success'}
//    size      {'sm'|'md'|'lg'}
//    disabled  {boolean}
//    loading   {boolean}   — shows spinner, disables interaction
//    fullWidth {boolean}   — w-full
//    icon      {ReactNode} — optional icon to the left of label
//    onClick   {Function}
//    type      {'button'|'submit'|'reset'}
//    children  {ReactNode}
// ─────────────────────────────────────────────────────────────

// ── Variant styles ──────────────────────────────────────────
const VARIANT = {
  primary: `
    bg-blue-600 text-white border-transparent
    hover:bg-blue-700
    active:bg-blue-800
    focus-visible:ring-blue-400
    shadow-sm shadow-blue-200
    hover:shadow-md hover:shadow-blue-200
  `,
  secondary: `
    bg-white text-slate-700 border-slate-300
    hover:bg-slate-50 hover:border-slate-400 hover:text-slate-900
    active:bg-slate-100
    focus-visible:ring-slate-400
    shadow-sm
  `,
  danger: `
    bg-red-600 text-white border-transparent
    hover:bg-red-700
    active:bg-red-800
    focus-visible:ring-red-400
    shadow-sm shadow-red-200
    hover:shadow-md hover:shadow-red-200
  `,
  ghost: `
    bg-transparent text-slate-600 border-transparent
    hover:bg-slate-100 hover:text-slate-900
    active:bg-slate-200
    focus-visible:ring-slate-400
  `,
  success: `
    bg-emerald-600 text-white border-transparent
    hover:bg-emerald-700
    active:bg-emerald-800
    focus-visible:ring-emerald-400
    shadow-sm shadow-emerald-200
    hover:shadow-md hover:shadow-emerald-200
  `,
};

// ── Size styles ─────────────────────────────────────────────
const SIZE = {
  sm: 'h-8  px-3   text-xs  gap-1.5 rounded-lg',
  md: 'h-10 px-4   text-sm  gap-2   rounded-xl',
  lg: 'h-12 px-6   text-base gap-2.5 rounded-xl',
};

// ── Spinner size per button size ────────────────────────────
const SPINNER_SIZE = { sm: 12, md: 15, lg: 18 };

const Button = ({
  variant   = 'primary',
  size      = 'md',
  disabled  = false,
  loading   = false,
  fullWidth = false,
  icon      = null,
  onClick,
  type      = 'button',
  children,
  className = '',
  ...rest
}) => {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={`
        inline-flex items-center justify-center
        font-semibold border
        transition-all duration-200
        focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
        active:scale-[0.97]
        select-none whitespace-nowrap
        ${SIZE[size]    ?? SIZE.md}
        ${VARIANT[variant] ?? VARIANT.primary}
        ${fullWidth ? 'w-full' : ''}
        ${isDisabled
          ? 'opacity-50 cursor-not-allowed pointer-events-none shadow-none'
          : 'cursor-pointer'}
        ${className}
      `}
      aria-busy={loading}
      aria-disabled={isDisabled}
      {...rest}
    >
      {/* Spinner replaces icon when loading */}
      {loading ? (
        <Loader2
          size={SPINNER_SIZE[size]}
          className="animate-spin shrink-0"
          aria-hidden="true"
        />
      ) : icon ? (
        <span className="shrink-0 flex items-center" aria-hidden="true">
          {icon}
        </span>
      ) : null}

      {/* Label — hidden visually when loading and no children text needed */}
      {children && (
        <span className={loading ? 'opacity-70' : ''}>
          {children}
        </span>
      )}
    </button>
  );
};

export default Button;