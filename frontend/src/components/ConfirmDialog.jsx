import { AlertCircle } from 'lucide-react';

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
  if (!isOpen) return null;

  const variantConfig = {
    default: {
      buttonColor: 'bg-[var(--accent)] hover:bg-[var(--accent-deep)]',
      iconBg: 'bg-[var(--accent)]/10',
      iconColor: 'text-[var(--accent-deep)]',
    },
    danger: {
      buttonColor: 'bg-red-600 hover:bg-red-700',
      iconBg: 'bg-red-50',
      iconColor: 'text-red-600',
    },
  };

  const config = variantConfig[variant] || variantConfig.default;

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      <div className="bg-[var(--paper)] rounded-2xl shadow-lg max-w-sm w-full p-6 border border-[var(--border)]">
        <div className={`${config.iconBg} w-12 h-12 rounded-full flex items-center justify-center mb-4`}>
          <AlertCircle className={config.iconColor} size={24} />
        </div>

        <h2
          id="dialog-title"
          className="text-lg font-semibold text-[color:var(--ink)] mb-2"
        >
          {title}
        </h2>

        <p className="text-[color:var(--muted)] text-sm mb-6">
          {message}
        </p>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg border border-[var(--border)] text-[color:var(--ink)] hover:bg-[var(--paper-2)] transition-colors disabled:opacity-50 font-medium text-sm"
            type="button"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 rounded-lg ${config.buttonColor} text-white transition-colors disabled:opacity-50 font-medium text-sm flex items-center gap-2`}
            type="button"
          >
            {isLoading ? (
              <>
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
