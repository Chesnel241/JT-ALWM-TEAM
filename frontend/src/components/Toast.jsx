import { AlertCircle, CheckCircle, InfoIcon, X } from 'lucide-react';
import { useToast } from '../hooks/useToast.jsx';
import { useI18n } from '../i18n/I18nContext.jsx';

const STYLES = {
  success: { Icon: CheckCircle, classes: 'bg-green-50 border-green-200 text-green-900', icone: 'text-green-700' },
  error: { Icon: AlertCircle, classes: 'bg-red-50 border-red-200 text-red-900', icone: 'text-red-700' },
  info: { Icon: InfoIcon, classes: 'bg-blue-50 border-blue-200 text-blue-900', icone: 'text-blue-700' },
};

function ToastItem({ message, type, action, onRemove, libelleFermer }) {
  // Le minuteur vit dans le fournisseur, qui connaît la durée demandée. Le
  // composant en posait un second, fixé à 3 s, qui l'emportait toujours.
  const { Icon, classes, icone } = STYLES[type] || STYLES.info;
  const erreur = type === 'error';

  return (
    <div
      className={`toast-item ${classes} pointer-events-auto border rounded-xl pl-4 pr-1.5 py-2 flex items-center gap-3 shadow-md`}
      role={erreur ? 'alert' : 'status'}
      aria-live={erreur ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <Icon className={`${icone} flex-shrink-0`} size={20} aria-hidden="true" />
      <p className="text-sm font-semibold flex-1 py-1">{message}</p>
      {action && (
        <button
          type="button"
          onClick={() => { action.onClick?.(); onRemove(); }}
          className="flex-shrink-0 min-h-[40px] rounded-lg px-3 text-sm font-bold underline underline-offset-2 hover:bg-black/5"
        >
          {action.libelle}
        </button>
      )}
      <button
        onClick={onRemove}
        className="flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-lg hover:bg-black/5"
        aria-label={libelleFermer}
        type="button"
      >
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * Où les messages s'affichent.
 *
 * Sur téléphone, ils se posaient **sur** la barre d'onglets (même coin, même
 * hauteur) et masquaient « Envoyer » ; et ils passaient sous les fenêtres
 * (z-50 contre 10001), donc invisibles au moment même où une fenêtre les
 * déclenchait. Ils montent désormais au-dessus de la barre, et des fenêtres.
 */
export default function ToastContainer() {
  const { toasts, removeToast } = useToast();
  const { t } = useI18n();

  if (toasts.length === 0) return null;

  return (
    <div
      className="toast-zone fixed inset-x-4 sm:inset-x-auto sm:right-6 z-[10050] flex flex-col gap-2 pointer-events-none sm:max-w-sm"
      role="region"
      aria-label={t.toast.region}
    >
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          message={toast.message}
          type={toast.type}
          action={toast.action}
          libelleFermer={t.toast.fermer}
          onRemove={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}
