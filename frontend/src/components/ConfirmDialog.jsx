import { AlertCircle } from 'lucide-react';
import { useEffect, useRef } from 'react';

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
  variant = 'default',
  onConfirm,
  onCancel,
  isLoading = false,
}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCancel();
      }
      if (e.key === 'Tab') {
        if (!dialogRef.current) return;
        const focusableElements = dialogRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    
    // Focus input if present, otherwise first button
    if (dialogRef.current) {
      const input = dialogRef.current.querySelector('input, textarea');
      if (input) {
        input.focus();
      } else {
        const focusableElements = dialogRef.current.querySelectorAll('button');
        if (focusableElements.length > 0) {
          focusableElements[0].focus();
        }
      }
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const variantConfig = {
    default: {
      buttonColor: 'bg-[var(--accent)] hover:bg-[var(--accent-deep)]',
      iconBg: 'bg-[var(--accent)]/10',
      iconColor: 'text-[var(--accent-deep)]',
    },
    danger: {
      buttonColor: 'bg-[var(--signal)] hover:opacity-80',
      iconBg: 'bg-[var(--signal)]/10',
      iconColor: 'text-[var(--signal)]',
    },
  };

  const config = variantConfig[variant] || variantConfig.default;

  return (
    <div
      className="fixed inset-0 bg-[var(--ink)]/30 flex items-center justify-center z-[10001] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
      aria-describedby="dialog-description"
    >
      <div 
        ref={dialogRef}
        className="bg-[var(--paper)] rounded-2xl shadow-lg max-w-sm w-full p-6 border border-[var(--border)]"
      >
        <div className={`${config.iconBg} w-12 h-12 rounded-full flex items-center justify-center mb-4`}>
          <AlertCircle className={config.iconColor} size={24} aria-hidden="true" />
        </div>

        <h2
          id="dialog-title"
          className="text-lg font-semibold text-[color:var(--ink)] mb-2"
        >
          {title}
        </h2>

        <div id="dialog-description" className="text-[color:var(--muted)] text-sm mb-6">
          {message}
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg border border-[var(--border)] text-[color:var(--ink)] hover:bg-[var(--paper-2)] transition-colors disabled:opacity-50 font-medium text-sm focus:outline-none focus-ring"
            type="button"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 rounded-lg ${config.buttonColor} text-[var(--paper)] transition-colors disabled:opacity-50 font-medium text-sm flex items-center gap-2 focus:outline-none focus-ring`}
            type="button"
          >
            {isLoading ? (
              <>
                <div className="h-4 w-4 border-2 border-[var(--paper)] border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                <span className="sr-only">Chargement</span>
                En cours...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
