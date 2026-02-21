import { useEffect, useRef, useCallback } from 'react';
import { X } from 'lucide-react';

// ─────────────────────────────────────────────────────────────
//  Modal
//  Props:
//    isOpen   {boolean}         — controls visibility
//    onClose  {() => void}      — called on overlay click, X, or ESC
//    title    {string}          — header text
//    subtitle {string?}         — optional smaller text below title
//    size     {'sm'|'md'|'lg'|'xl'|'full'} — max-width (default 'md')
//    children {ReactNode}       — scrollable body content
// ─────────────────────────────────────────────────────────────

const SIZE_CLASSES = {
  sm:   'max-w-sm',
  md:   'max-w-2xl',
  lg:   'max-w-4xl',
  xl:   'max-w-6xl',
  full: 'max-w-[95vw]',
};

const Modal = ({
  isOpen,
  onClose,
  title,
  subtitle,
  size = 'md',
  children,
}) => {
  const panelRef    = useRef(null);
  const prevFocusRef = useRef(null);

  // ── ESC key handler ─────────────────────────────────────
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  // ── Lifecycle: lock body scroll, trap focus, listen ESC ─
  useEffect(() => {
    if (!isOpen) return;

    prevFocusRef.current = document.activeElement;

    // Prevent background scroll
    const scrollY = window.scrollY;
    document.body.style.overflow = 'hidden';
    document.body.style.top      = `-${scrollY}px`;
    document.body.style.position = 'fixed';
    document.body.style.width    = '100%';

    document.addEventListener('keydown', handleKeyDown);

    // Move focus into modal
    requestAnimationFrame(() => {
      panelRef.current?.focus();
    });

    return () => {
      document.removeEventListener('keydown', handleKeyDown);

      // Restore scroll position
      document.body.style.overflow = '';
      document.body.style.top      = '';
      document.body.style.position = '';
      document.body.style.width    = '';
      window.scrollTo(0, scrollY);

      // Return focus to trigger element
      prevFocusRef.current?.focus();
    };
  }, [isOpen, handleKeyDown]);

  // ── Overlay click — only close if clicking the backdrop ─
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Don't render anything to the DOM when closed
  if (!isOpen) return null;

  return (
    /* ── Backdrop ─────────────────────────────────────────── */
    <div
      className="modal-backdrop"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* ── Panel ───────────────────────────────────────────── */}
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`
          modal-panel w-full ${SIZE_CLASSES[size] ?? SIZE_CLASSES.md}
          modal-panel-enter
          flex flex-col
          max-h-[calc(100vh-2rem)]
          outline-none
        `}
      >
        {/* ── Header ──────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-slate-100 shrink-0">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-slate-900 leading-tight truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="text-sm text-slate-500 mt-0.5 leading-snug">
                {subtitle}
              </p>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="
              flex items-center justify-center w-8 h-8 rounded-lg shrink-0
              text-slate-400 hover:text-slate-700
              bg-transparent hover:bg-slate-100
              border border-transparent hover:border-slate-200
              transition-all duration-150
              focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400
            "
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        {/* ── Scrollable body ──────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-6 min-h-0">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;