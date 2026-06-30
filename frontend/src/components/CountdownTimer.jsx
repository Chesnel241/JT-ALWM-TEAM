import { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext.jsx';

export default function CountdownTimer({ week }) {
  const { t } = useI18n();
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
    <div id="tour-countdown" className={`panel p-6 sm:p-8 mb-8 flex flex-col md:flex-row items-center gap-6 sm:gap-10 transition-all ${isLate ? '!border-2 !border-[var(--signal)]/50 !bg-[var(--signal)]/10' : 'bg-gradient-to-br from-[var(--paper)] to-[var(--paper-2)]'}`}>
      <div className="relative flex items-center justify-center flex-shrink-0">
        <svg className="transform -rotate-90 w-36 h-36">
          <circle
            cx="72"
            cy="72"
            r={radius}
            stroke="currentColor"
            strokeWidth="6"
            fill="transparent"
            className={isLate ? 'text-[var(--signal)] opacity-20' : 'text-[var(--border)]'}
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
            className={`transition-all duration-1000 ease-[var(--ease-out)] ${isLate ? 'text-[var(--signal)]' : 'text-[color:var(--accent)]'}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {isLate ? (
            <span className="text-xl font-black text-[var(--signal)] tracking-wider">
              {t.countdown.finished}
            </span>
          ) : (
            <>
              <span className="text-2xl font-black tabular-nums tracking-tight text-[color:var(--ink)]">
                {d}{t.countdown.days} {h.toString().padStart(2, '0')}{t.countdown.hours}
              </span>
              <span className="text-xs font-bold text-[color:var(--muted)]">
                {m.toString().padStart(2, '0')}{t.countdown.minutes} {s.toString().padStart(2, '0')}{t.countdown.seconds}
              </span>
            </>
          )}
        </div>
      </div>
      
      <div className="flex-1 text-center md:text-left">
        {isLate ? (
          <>
            <h2 className="text-2xl font-black text-[var(--signal)] flex items-center justify-center md:justify-start gap-2 mb-2">
              <AlertCircle size={28} className="animate-pulse text-[var(--signal)]" />
              {t.countdown.lateTitle}
            </h2>
            <p className="text-[var(--ink)] font-medium">
              {t.countdown.lateDesc}
            </p>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold text-[color:var(--ink)] mb-2">
              {t.countdown.normalTitle}
            </h2>
            <p className="text-[color:var(--muted)]">
              {t.countdown.normalDesc.before}
              <strong className="text-[color:var(--ink)]">{t.countdown.normalDesc.bold}</strong>
              {t.countdown.normalDesc.after}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
