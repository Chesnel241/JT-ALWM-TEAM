import { Globe, LayoutDashboard } from 'lucide-react';

export default function Nav({ currentView, setCurrentView }) {
  return (
    <nav className="border-b border-[var(--border)] bg-[var(--paper)] sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-full bg-[var(--accent)]/15 flex items-center justify-center">
            <Globe className="text-[color:var(--accent-deep)]" size={24} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[color:var(--muted)]">JT ALWM</p>
            <h1 className="text-xl font-semibold text-[color:var(--ink)]">Hub de reportages</h1>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
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
            Espace Correspondants
          </button>
          <button
            onClick={() => setCurrentView('dashboard')}
            type="button"
            aria-current={currentView === 'dashboard' ? 'page' : undefined}
            className={`btn flex items-center gap-2 ${
              currentView === 'dashboard'
                ? 'btn-primary'
                : 'btn-ghost border border-[var(--border)]'
            }`}
          >
            <LayoutDashboard size={18} />
            Espace Montage
          </button>
        </div>
      </div>
    </nav>
  );
}
