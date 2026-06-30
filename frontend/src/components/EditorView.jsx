import { useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';

/**
 * EditorView — Redirect vers le Studio de Montage (DashboardView).
 *
 * Le studio de montage complet vit dans DashboardView sous l'onglet
 * "Studio de Montage". Cette vue standalone n'est pas un éditeur à
 * part entière ; elle redirige vers le Dashboard avec le studio
 * pré-sélectionné.
 */
export default function EditorView({ setCurrentView }) {
  const { t } = useI18n();

  useEffect(() => {
    // Redirection immédiate vers le Dashboard (Studio de Montage)
    if (typeof setCurrentView === 'function') {
      setCurrentView('dashboard');
    }
  }, [setCurrentView]);

  return (
    <div className="p-8 text-center text-[color:var(--muted)]">
      <p className="text-lg font-semibold text-[color:var(--ink)]">
        {t.nav?.editing || 'Espace Montage'}
      </p>
      <p className="text-sm mt-2">
        Redirection vers le Studio de Montage...
      </p>
    </div>
  );
}
