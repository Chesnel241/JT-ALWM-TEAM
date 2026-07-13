import { useI18n } from '../i18n/I18nContext.jsx';

export default function LanguageSwitcher({ compact = false }) {
  const { lang, setLang, t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t.langSwitcher.label}
      className={`inline-flex rounded-full border border-[var(--border)] bg-[var(--paper-2)] shadow-inner ${compact ? 'p-0.5' : 'p-1'}`}
    >
      <button
        type="button"
        onClick={() => setLang('fr')}
        aria-pressed={lang === 'fr'}
        className={`${compact ? 'h-8 px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'} rounded-full transition-[transform,background-color,color,opacity,box-shadow] duration-150 active:scale-[0.97] font-bold flex items-center gap-1.5 ${
          lang === 'fr'
            ? 'bg-[var(--paper)] text-[color:var(--ink)] shadow-sm'
            : 'text-[color:var(--muted)] hover:text-[color:var(--ink)] opacity-70 hover:opacity-100'
        }`}
      >
        <span className={compact ? 'text-sm' : 'text-base'} aria-hidden="true">🇫🇷</span>
        {!compact && 'FR'}
      </button>
      <button
        type="button"
        onClick={() => setLang('en')}
        aria-pressed={lang === 'en'}
        className={`${compact ? 'h-8 px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'} rounded-full transition-[transform,background-color,color,opacity,box-shadow] duration-150 active:scale-[0.97] font-bold flex items-center gap-1.5 ${
          lang === 'en'
            ? 'bg-[var(--paper)] text-[color:var(--ink)] shadow-sm'
            : 'text-[color:var(--muted)] hover:text-[color:var(--ink)] opacity-70 hover:opacity-100'
        }`}
      >
        <span className={compact ? 'text-sm' : 'text-base'} aria-hidden="true">🇬🇧</span>
        {!compact && 'EN'}
      </button>
    </div>
  );
}
