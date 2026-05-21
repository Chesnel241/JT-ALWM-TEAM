import { useI18n } from '../i18n/I18nContext.jsx';
import { Users, Info, MapPin, Clock, HelpCircle, Wrench } from 'lucide-react';

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

  if (!t.tutorial) return null;

  const items = [
    { id: 'who', color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30', border: 'border-blue-200 dark:border-blue-800' },
    { id: 'what', color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30', border: 'border-purple-200 dark:border-purple-800' },
    { id: 'where', color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/30', border: 'border-emerald-200 dark:border-emerald-800' },
    { id: 'when', color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30', border: 'border-amber-200 dark:border-amber-800' },
    { id: 'why', color: 'text-rose-500', bg: 'bg-rose-100 dark:bg-rose-900/30', border: 'border-rose-200 dark:border-rose-800' },
    { id: 'how', color: 'text-cyan-500', bg: 'bg-cyan-100 dark:bg-cyan-900/30', border: 'border-cyan-200 dark:border-cyan-800' },
  ];

  return (
    <div className="panel p-6 sm:p-8 mb-8 border-l-4 border-l-[color:var(--accent)] bg-gradient-to-br from-[var(--paper)] to-[var(--paper-2)] overflow-hidden relative">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 -mt-16 -mr-16 text-[var(--accent)] opacity-5 pointer-events-none">
        <svg width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 16v-4"></path>
          <path d="M12 8h.01"></path>
        </svg>
      </div>

      <div className="relative z-10">
        <div className="mb-6">
          <h3 className="text-2xl font-bold text-[color:var(--ink)] mb-2 tracking-tight">
            {t.tutorial.title}
          </h3>
          <p className="text-[color:var(--muted)] text-sm sm:text-base max-w-3xl">
            {t.tutorial.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
      </div>
    </div>
  );
}
