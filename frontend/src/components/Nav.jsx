import { LayoutDashboard, Sparkles } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext.jsx';
import LanguageSwitcher from './LanguageSwitcher.jsx';

export default function Nav({ currentView, setCurrentView, newUploadsCount }) {
  const { t } = useI18n();
  return (
    <nav className="border-b border-[var(--border)] bg-[var(--paper)] sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img
            src="/logo-lwm.png"
            alt="Logo ALWM"
            className="h-11 w-11 rounded-full object-contain"
          />
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--muted)]">{t.nav.brand}</p>
            <h1 className="text-xl font-semibold text-[color:var(--ink)]">{t.nav.tagline}</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <LanguageSwitcher />
          <button
            onClick={() => setCurrentView('home')}
            type="button"
            aria-current={currentView === 'home' || currentView === 'uploader' ? 'page' : undefined}
            className={`btn ${
              currentView === 'home' || currentView === 'uploader'
                ? 'btn-primary'
                : 'btn-ghost border border-[var(--border)]'
            }`}
          >
            {t.nav.correspondents}
          </button>
          <button
            onClick={() => setCurrentView('dashboard')}
            type="button"
            aria-current={currentView === 'dashboard' ? 'page' : undefined}
            className={`btn flex items-center gap-2 relative ${
              currentView === 'dashboard'
                ? 'btn-primary'
                : 'btn-ghost border border-[var(--border)]'
            }`}
          >
            <LayoutDashboard size={18} />
            {t.nav.editing}
            {newUploadsCount > 0 && currentView !== 'dashboard' && (
              <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm animate-pulse min-w-[20px] text-center">
                {newUploadsCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setCurrentView('delivery')}
            type="button"
            aria-current={currentView === 'delivery' ? 'page' : undefined}
            className={`btn flex items-center gap-2 ${
              currentView === 'delivery'
                ? 'btn-primary'
                : 'btn-ghost border border-[var(--border)]'
            }`}
          >
            <Sparkles size={18} />
            {t.nav.delivery}
          </button>
        </div>
      </div>
    </nav>
  );
}
