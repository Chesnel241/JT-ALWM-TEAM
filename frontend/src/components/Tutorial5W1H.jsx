import { useState, useEffect } from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';
import { Users, Info, MapPin, Clock, HelpCircle, Wrench, CheckCircle, X } from 'lucide-react';
import { usePiegeFocus } from '../hooks/usePiegeFocus.jsx';

const icons = {
  who: Users,
  what: Info,
  where: MapPin,
  when: Clock,
  why: HelpCircle,
  how: Wrench,
};

export default function Tutorial5W1H({ isOpen, onClose }) {
  const { t } = useI18n();
  const [internalVisible, setInternalVisible] = useState(false);

  useEffect(() => {
    if (isOpen === undefined) {
      const hasSeen = localStorage.getItem('hasSeen5W1H');
      if (!hasSeen) {
        setInternalVisible(true);
      }
    }
  }, [isOpen]);

  const isVisible = isOpen !== undefined ? isOpen : internalVisible;

  // Remontée au-dessus de la garde : le piège de focus doit la connaître, et
  // un hook ne se déclare pas après un retour anticipé.
  const handleDismiss = () => {
    localStorage.setItem('hasSeen5W1H', 'true');
    setInternalVisible(false);
    onClose?.();
  };

  // Le tutoriel s'ouvre au premier passage d'un correspondant. Il annonçait
  // `role="dialog" aria-modal="true"` sans retenir le clavier : Échap ne le
  // fermait pas, et la tabulation partait dans la page derrière lui.
  const boiteModale = usePiegeFocus(Boolean(t.tutorial && isVisible), handleDismiss);

  if (!t.tutorial || !isVisible) return null;

  const items = [
    { id: 'who', color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30', border: 'border-blue-200 dark:border-blue-800' },
    { id: 'what', color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30', border: 'border-purple-200 dark:border-purple-800' },
    { id: 'where', color: 'text-[var(--accent)]', bg: 'bg-[var(--accent)]/10 dark:bg-[var(--accent)]/30', border: 'border-[var(--accent)]/20 dark:border-[var(--accent)]/80' },
    { id: 'when', color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30', border: 'border-amber-200 dark:border-amber-800' },
    { id: 'why', color: 'text-rose-500', bg: 'bg-rose-100 dark:bg-rose-900/30', border: 'border-rose-200 dark:border-rose-800' },
    { id: 'how', color: 'text-cyan-500', bg: 'bg-cyan-100 dark:bg-cyan-900/30', border: 'border-cyan-200 dark:border-cyan-800' },
  ];

  return (
    <div ref={boiteModale} className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div 
        className="fixed inset-0" 
        onClick={handleDismiss} 
      />
      <div className="relative w-full max-w-5xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto bg-[var(--paper)] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-[var(--border)] motion-boite z-10 custom-scrollbar">
        <div className="p-5 sm:p-8 border-l-4 border-l-[color:var(--accent)] bg-gradient-to-br from-[var(--paper)] to-[var(--paper-2)] relative">
          
          {/* Mobile swipe notch */}
          <div className="w-12 h-1.5 bg-[var(--border)] rounded-full mx-auto mb-3 sm:hidden" />

          {/* Decorative background elements */}
          <div className="absolute top-0 right-0 -mt-16 -mr-16 text-[var(--accent)] opacity-5 pointer-events-none">
            <svg width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 16v-4"></path>
              <path d="M12 8h.01"></path>
            </svg>
          </div>

          <div className="relative z-10">
            <div className="mb-4 sm:mb-6 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-xl sm:text-3xl font-bold text-[color:var(--ink)] mb-1 sm:mb-2 tracking-tight">
                    {t.tutorial.title}
                  </h3>
                  <button
                    onClick={handleDismiss}
                    className="sm:hidden p-1 text-[color:var(--muted)] hover:text-[color:var(--ink)] rounded-full"
                  >
                    <X size={20} />
                  </button>
                </div>
                <p className="text-[color:var(--muted)] text-sm sm:text-base max-w-3xl">
                  {t.tutorial.subtitle}
                </p>
              </div>
              
              <button 
                onClick={handleDismiss}
                className="hidden md:flex shrink-0 items-center gap-2 bg-[var(--accent)] text-white hover:bg-[var(--accent-deep)] px-6 py-3 rounded-xl font-bold shadow-lg shadow-[var(--accent)]/30 motion-tap hover:scale-105 active:scale-95"
              >
                <CheckCircle size={20} />
                <span>J'ai compris</span>
              </button>
            </div>

            <div className="mb-4 sm:mb-6 p-3.5 sm:p-4 bg-[var(--accent)]/10 border border-[var(--accent)] rounded-xl flex gap-3 items-start">
              <Info className="text-[var(--accent)] shrink-0 mt-0.5" size={18} />
              <p className="text-xs sm:text-sm text-[var(--ink)]">
                <strong className="text-[var(--accent)]">Important :</strong> Un contact WhatsApp est requis pour vous avertir rapidement en cas de problème technique sur vos envois ou disponibilité du JT.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {items.map(({ id, color, bg, border }) => {
                const Icon = icons[id];
                return (
                  <div key={id} className={`p-3.5 sm:p-4 rounded-2xl border motion-tap hover:shadow-md bg-[var(--paper)] ${border} group`}>
                    <div className="flex flex-col h-full">
                      <div className="flex items-center gap-2.5 mb-2">
                        <div className={`p-2 rounded-xl ${bg} ${color} transition-transform group-hover:scale-110`}>
                          <Icon size={18} />
                        </div>
                        <h4 className="font-bold text-[color:var(--ink)] text-base">
                          {t.tutorial[id]}
                        </h4>
                      </div>
                      <p className="text-xs sm:text-sm font-medium text-[color:var(--ink)] mb-2">
                        {t.tutorial[`${id}Desc`]}
                      </p>
                      <p className="text-[11px] sm:text-xs text-[color:var(--muted)] italic mt-auto bg-black/5 dark:bg-white/5 p-2 rounded-lg border border-[var(--border)]">
                        {t.tutorial[`${id}Ex`]}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-6 flex justify-center md:hidden pb-2">
              <button 
                onClick={handleDismiss}
                className="w-full flex justify-center items-center gap-2 bg-[var(--accent)] text-white hover:bg-[var(--accent-deep)] px-6 py-3 rounded-xl font-bold shadow-lg shadow-[var(--accent)]/30 motion-tap active:scale-95 text-sm"
              >
                <CheckCircle size={18} />
                <span>J'ai compris</span>
              </button>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}
