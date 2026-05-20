import { useI18n } from '../i18n/I18nContext.jsx';

export default function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t.langSwitcher.label}
      className="inline-flex rounded-full border border-[var(--border)] bg-[var(--paper)] p-0.5 text-xs font-semibold"
    >
      <button
        type="button"
        onClick={() => setLang('fr')}
        aria-pressed={lang === 'fr'}
        className={`px-3 py-1 rounded-full transition-colors ${
          lang === 'fr'
            ? 'bg-[var(--accent)] text-white'
            : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
        }`}
      >
        FR
      </button>
      <button
        type="button"
        onClick={() => setLang('en')}
        aria-pressed={lang === 'en'}
        className={`px-3 py-1 rounded-full transition-colors ${
          lang === 'en'
            ? 'bg-[var(--accent)] text-white'
            : 'text-[color:var(--muted)] hover:text-[color:var(--ink)]'
        }`}
      >
        EN
      </button>
    </div>
  );
}
