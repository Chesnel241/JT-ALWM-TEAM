import { useEffect } from 'react';
import { AlertCircle, CheckCircle, InfoIcon, X } from 'lucide-react';
import { useToast } from '../hooks/useToast.jsx';

function ToastItem({ id, message, type, onRemove }) {
  useEffect(() => {
    const timer = setTimeout(onRemove, 3000);
    return () => clearTimeout(timer);
  }, [onRemove]);

  const typeConfig = {
    success: {
      Icon: CheckCircle,
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-900',
      iconColor: 'text-green-600',
    },
    error: {
      Icon: AlertCircle,
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-900',
      iconColor: 'text-red-600',
    },
    info: {
      Icon: InfoIcon,
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-900',
      iconColor: 'text-blue-600',
    },
  };

  const config = typeConfig[type] || typeConfig.info;
  const { Icon, bgColor, borderColor, textColor, iconColor } = config;

  return (
    <div
      className={`${bgColor} ${borderColor} ${textColor} border rounded-lg px-4 py-3 flex items-center gap-3 shadow-sm animate-fadeIn`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <Icon className={`${iconColor} flex-shrink-0`} size={18} />
      <p className="text-sm font-medium flex-1">{message}</p>
      <button
        onClick={onRemove}
        className="flex-shrink-0 hover:opacity-70 transition-opacity"
        aria-label="Dismiss notification"
        type="button"
      >
        <X size={16} />
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-6 right-6 space-y-3 z-50 pointer-events-auto max-w-sm"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          id={toast.id}
          message={toast.message}
          type={toast.type}
          onRemove={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}
