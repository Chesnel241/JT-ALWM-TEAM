import { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';
import { Users, Info, MapPin, Clock, HelpCircle, Wrench, CheckCircle } from 'lucide-react';

const icons = {
  who: Users,
  what: Info,
  where: MapPin,
  when: Clock,
  why: HelpCircle,
  how: Wrench,
};

export default function Tutorial5W1H() {
  const { t } = useI18n();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Vérifie si l'utilisateur a déjà cliqué sur "J'ai compris"
    const hasSeen = localStorage.getItem('hasSeen5W1H');
    if (!hasSeen) {
      setIsVisible(true);
    }
  }, []);

  if (!t.tutorial || !isVisible) return null;

  const handleDismiss = () => {
    localStorage.setItem('hasSeen5W1H', 'true');
    setIsVisible(false);
  };

  const items = [
    { id: 'who', color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30', border: 'border-blue-200 dark:border-blue-800' },
    { id: 'what', color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30', border: 'border-purple-200 dark:border-purple-800' },
    { id: 'where', color: 'text-[var(--accent)]', bg: 'bg-[var(--accent)]/10 dark:bg-[var(--accent)]/30', border: 'border-[var(--accent)]/20 dark:border-[var(--accent)]/80' },
    { id: 'when', color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30', border: 'border-amber-200 dark:border-amber-800' },
    { id: 'why', color: 'text-rose-500', bg: 'bg-rose-100 dark:bg-rose-900/30', border: 'border-rose-200 dark:border-rose-800' },
    { id: 'how', color: 'text-cyan-500', bg: 'bg-cyan-100 dark:bg-cyan-900/30', border: 'border-cyan-200 dark:border-cyan-800' },
  ];

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto bg-[var(--paper)] rounded-3xl shadow-2xl border border-[var(--border)] animate-in fade-in zoom-in duration-300">
        <div className="p-6 sm:p-8 border-l-4 border-l-[color:var(--accent)] bg-gradient-to-br from-[var(--paper)] to-[var(--paper-2)] relative">
          
          {/* Decorative background elements */}
          <div className="absolute top-0 right-0 -mt-16 -mr-16 text-[var(--accent)] opacity-5 pointer-events-none">
            <svg width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 16v-4"></path>
              <path d="M12 8h.01"></path>
            </svg>
          </div>

          <div className="relative z-10">
            <div className="mb-6 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <h3 className="text-2xl sm:text-3xl font-bold text-[color:var(--ink)] mb-2 tracking-tight">
                  {t.tutorial.title}
                </h3>
                <p className="text-[color:var(--muted)] text-base sm:text-lg max-w-3xl">
                  {t.tutorial.subtitle}
                </p>
              </div>
              
              <button 
                onClick={handleDismiss}
                className="shrink-0 flex items-center gap-2 bg-[var(--accent)] text-white hover:bg-[var(--accent-deep)] px-6 py-3 rounded-xl font-bold shadow-lg shadow-[var(--accent)]/30 transition-all hover:scale-105 active:scale-95"
              >
                <CheckCircle size={20} />
                <span>J'ai compris</span>
              </button>
            </div>

            <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex gap-3 items-start">
              <Info className="text-amber-500 shrink-0 mt-0.5" size={20} />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Important :</strong> Vous devrez désormais fournir un numéro WhatsApp de contact 
                avant de pouvoir téléverser vos fichiers. Cela nous permet de vous avertir très rapidement 
                en cas de problème technique (son, image) ou pour vous notifier de la disponibilité du JT.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map(({ id, color, bg, border }) => {
                const Icon = icons[id];
                return (
                  <div key={id} className={`p-4 rounded-2xl border transition-all hover:shadow-md bg-[var(--paper)] ${border} group`}>
                    <div className="flex flex-col h-full">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`p-2 rounded-xl ${bg} ${color} transition-transform group-hover:scale-110`}>
                          <Icon size={20} />
                        </div>
                        <h4 className="font-bold text-[color:var(--ink)] text-lg">
                          {t.tutorial[id]}
                        </h4>
                      </div>
                      <p className="text-sm font-medium text-[color:var(--ink)] mb-2">
                        {t.tutorial[`${id}Desc`]}
                      </p>
                      <p className="text-xs text-[color:var(--muted)] italic mt-auto bg-black/5 dark:bg-white/5 p-2 rounded-lg border border-[var(--border)]">
                        {t.tutorial[`${id}Ex`]}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-8 flex justify-center md:hidden">
              <button 
                onClick={handleDismiss}
                className="w-full flex justify-center items-center gap-2 bg-[var(--accent)] text-white hover:bg-[var(--accent-deep)] px-6 py-3 rounded-xl font-bold shadow-lg shadow-[var(--accent)]/30 transition-all active:scale-95"
              >
                <CheckCircle size={20} />
                <span>J'ai compris</span>
              </button>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}
