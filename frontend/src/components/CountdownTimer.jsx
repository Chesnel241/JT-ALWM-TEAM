import { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

export default function CountdownTimer({ week }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!week || !week.startDate) return null;

  const start = new Date(week.startDate);
  const end = new Date(start);
  end.setDate(end.getDate() + 6); // Dimanche
  end.setHours(17, 30, 0, 0); // 17h30

  const totalDuration = end.getTime() - start.getTime();
  const remaining = end.getTime() - now.getTime();
  
  const isLate = remaining <= 0;
  
  let percentage = isLate ? 0 : Math.max(0, (remaining / totalDuration) * 100);
  if (now.getTime() < start.getTime()) percentage = 100; // Future week

  const absRemaining = Math.abs(remaining);
  const d = Math.floor(absRemaining / (1000 * 60 * 60 * 24));
  const h = Math.floor((absRemaining / (1000 * 60 * 60)) % 24);
  const m = Math.floor((absRemaining / 1000 / 60) % 60);
  const s = Math.floor((absRemaining / 1000) % 60);

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className={`panel p-6 sm:p-8 mb-8 flex flex-col md:flex-row items-center gap-6 sm:gap-10 transition-all ${isLate ? 'border-2 border-red-500/50 bg-red-50/50 dark:bg-red-950/20' : 'bg-gradient-to-br from-[var(--paper)] to-[var(--paper-2)]'}`}>
      <div className="relative flex items-center justify-center flex-shrink-0">
        <svg className="transform -rotate-90 w-36 h-36">
          <circle
            cx="72"
            cy="72"
            r={radius}
            stroke="currentColor"
            strokeWidth="6"
            fill="transparent"
            className={isLate ? 'text-red-200 dark:text-red-900/50' : 'text-[var(--border)]'}
          />
          <circle
            cx="72"
            cy="72"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className={`${isLate ? 'text-red-500' : 'text-[color:var(--accent)]'} transition-all duration-1000 ease-linear`}
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center">
          {isLate ? (
            <span className="text-xl font-black text-red-500">TERMINE</span>
          ) : (
            <>
              <span className="text-2xl font-black tabular-nums tracking-tight text-[color:var(--ink)]">
                {d}j {h.toString().padStart(2, '0')}h
              </span>
              <span className="text-xs font-bold text-[color:var(--muted)]">
                {m.toString().padStart(2, '0')}m {s.toString().padStart(2, '0')}s
              </span>
            </>
          )}
        </div>
      </div>
      
      <div className="flex-1 text-center md:text-left">
        {isLate ? (
          <>
            <h2 className="text-2xl font-black text-red-600 dark:text-red-400 flex items-center justify-center md:justify-start gap-2 mb-2">
              <AlertCircle size={28} className="animate-pulse" />
              VOUS êtes en retard, le JT est finalisé
            </h2>
            <p className="text-red-500/80 dark:text-red-300/80 font-medium">
              La date limite d'envoi pour cette semaine (Dimanche 17h30) est dépassée. Vos envois seront tout de même traités si nécessaire.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold text-[color:var(--ink)] mb-2">
              Délai de soumission
            </h2>
            <p className="text-[color:var(--muted)]">
              Le JT doit être finalisé avant <strong className="text-[color:var(--ink)]">Dimanche 17h30</strong>. Le compteur ci-contre vous indique le temps restant pour uploader vos sujets sereinement.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
