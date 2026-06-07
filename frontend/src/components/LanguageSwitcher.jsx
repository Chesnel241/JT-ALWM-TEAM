import { useI18n } from '../i18n/I18nContext.jsx';

export default function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t.langSwitcher.label}
      className="inline-flex rounded-full border border-[var(--border)] bg-[var(--paper-2)] p-1 shadow-inner"
    >
      <button
        type="button"
        onClick={() => setLang('fr')}
        aria-pressed={lang === 'fr'}
        className={`px-3 py-1.5 rounded-full transition-all text-sm font-bold flex items-center gap-1.5 ${
          lang === 'fr'
            ? 'bg-[var(--paper)] text-[color:var(--ink)] shadow-sm'
            : 'text-[color:var(--muted)] hover:text-[color:var(--ink)] opacity-70 hover:opacity-100'
        }`}
      >
        <span className="text-base" aria-hidden="true">🇫🇷</span>
        FR
      </button>
      <button
        type="button"
        onClick={() => setLang('en')}
        aria-pressed={lang === 'en'}
        className={`px-3 py-1.5 rounded-full transition-all text-sm font-bold flex items-center gap-1.5 ${
          lang === 'en'
            ? 'bg-[var(--paper)] text-[color:var(--ink)] shadow-sm'
            : 'text-[color:var(--muted)] hover:text-[color:var(--ink)] opacity-70 hover:opacity-100'
        }`}
      >
        <span className="text-base" aria-hidden="true">🇬🇧</span>
        EN
      </button>
    </div>
  );
}
