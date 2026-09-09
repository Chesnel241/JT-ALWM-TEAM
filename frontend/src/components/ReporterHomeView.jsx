import { Upload, Download, ChevronRight, MessageCircle } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext.jsx';
import { whatsappSupportLink } from '../lib/support.js';

/**
 * Accueil de l'espace journalistes (URL /journalistes) : deux boutons, rien
 * d'autre. Beaucoup de correspondants sont peu à l'aise avec le web et
 * arrivent depuis un lien WhatsApp sur mobile — d'où des cibles tactiles
 * très larges (carte cliquable entière), un libellé par action et une
 * numérotation visuelle pour lever toute hésitation.
 */
export default function ReporterHomeView({ onOpenReports, onOpenDelivery }) {
  const { t } = useI18n();
  const r = t.reporter;

  const choices = [
    {
      key: 'reports',
      step: 1,
      Icon: Upload,
      title: r.uploadTitle,
      text: r.uploadText,
      cta: r.uploadCta,
      onClick: onOpenReports,
      // Accent maison pour l'action principale (envoyer un reportage).
      tone: {
        card: 'border-[color:var(--accent)]/40 hover:border-[color:var(--accent)]',
        icon: 'bg-[var(--accent)] text-white',
        cta: 'bg-[var(--accent)] text-white shadow-md shadow-[var(--accent)]/25',
        step: 'bg-[var(--accent)]/10 text-[color:var(--accent-deep)]',
      },
    },
    {
      key: 'delivery',
      step: 2,
      Icon: Download,
      title: r.downloadTitle,
      text: r.downloadText,
      cta: r.downloadCta,
      onClick: onOpenDelivery,
      tone: {
        card: 'border-[var(--border)] hover:border-emerald-500',
        icon: 'bg-emerald-600 text-white',
        cta: 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25',
        step: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
      },
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-14">
      <div className="text-center mb-8 sm:mb-12">
        <span className="badge bg-[var(--accent)]/10 text-[color:var(--accent-deep)]">
          {r.badge}
        </span>
        <h2 className="mt-4 text-2xl sm:text-4xl font-bold text-[color:var(--ink)] leading-tight">
          {r.title}
        </h2>
        <p className="mt-3 text-base sm:text-lg text-[color:var(--muted)] max-w-xl mx-auto">
          {r.subtitle}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {choices.map(({ key, step, Icon, title, text, cta, onClick, tone }) => (
          <button
            key={key}
            type="button"
            onClick={onClick}
            className={`group w-full text-left bg-[var(--paper)] border-2 ${tone.card} rounded-3xl p-6 sm:p-8 shadow-sm transition-all active:scale-[0.98] sm:hover:shadow-[var(--shadow-soft)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--accent)]/40 flex flex-col gap-4 min-h-[220px] sm:min-h-[280px]`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className={`h-16 w-16 sm:h-20 sm:w-20 rounded-2xl flex items-center justify-center ${tone.icon}`}>
                <Icon size={34} strokeWidth={2.2} />
              </div>
              <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full ${tone.step}`}>
                {step}
              </span>
            </div>

            <div className="flex-1">
              <h3 className="text-xl sm:text-2xl font-bold text-[color:var(--ink)] leading-snug">
                {title}
              </h3>
              <p className="mt-2 text-sm sm:text-base text-[color:var(--muted)] leading-relaxed">
                {text}
              </p>
            </div>

            <span
              className={`inline-flex items-center justify-center gap-2 w-full px-5 py-4 rounded-2xl font-bold text-base ${tone.cta}`}
            >
              <span>{cta}</span>
              <ChevronRight size={20} className="transition-transform sm:group-hover:translate-x-1" />
            </span>
          </button>
        ))}
      </div>

      <div className="mt-8 sm:mt-12 p-5 sm:p-6 rounded-3xl bg-[var(--paper-2)] border border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
        <div>
          <p className="font-bold text-[color:var(--ink)]">{r.helpTitle}</p>
          <p className="text-sm text-[color:var(--muted)] mt-1">{r.helpText}</p>
        </div>
        <a
          href={whatsappSupportLink(r.helpMessage)}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-sm shadow-sm active:scale-95 transition-all"
        >
          <MessageCircle size={18} />
          {r.helpCta}
        </a>
      </div>
    </div>
  );
}
