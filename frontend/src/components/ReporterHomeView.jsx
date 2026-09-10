import { Upload, Download, ChevronRight, MessageCircle, Bell } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext.jsx';
import { whatsappSupportLink } from '../lib/support.js';
import NotificationToggle from './NotificationToggle.jsx';

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
      // Bleu profond du logo : fond plein, texte blanc (8,6:1).
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
      // Bleu clair du logo pour la tuile d'icône : il n'accepte que du texte
      // foncé (2,3:1 avec du blanc), d'où l'encre sur la pastille et le bleu
      // profond conservé sur le bouton.
      tone: {
        card: 'border-[var(--border)] hover:border-[color:var(--accent-soft)]',
        icon: 'bg-[var(--accent-soft)] text-[#111827]',
        cta: 'bg-[var(--accent)] text-white shadow-md shadow-[var(--accent)]/25',
        step: 'bg-[var(--accent-soft)]/25 text-[color:var(--accent-deep)]',
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

      {/* Sur téléphone la cloche de l'en-tête est réduite à une icône : cet
          encart rend l'abonnement visible là où il a du sens. */}
      <div className="mt-4 sm:mt-6 p-5 sm:p-6 rounded-3xl bg-[var(--paper)] border border-[var(--border)] flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-start gap-3 flex-1 text-left">
          <span className="h-11 w-11 shrink-0 rounded-2xl bg-[var(--accent)]/10 text-[color:var(--accent-deep)] flex items-center justify-center">
            <Bell size={22} />
          </span>
          <div className="min-w-0">
            <p className="font-bold text-[color:var(--ink)]">{r.notifyTitle}</p>
            <p className="text-sm text-[color:var(--muted)] mt-0.5">{r.notifyText}</p>
          </div>
        </div>
        <div className="shrink-0 sm:self-center">
          <NotificationToggle />
        </div>
      </div>

      <div className="mt-4 p-5 sm:p-6 rounded-3xl bg-[var(--paper-2)] border border-[var(--border)] flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 text-left">
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
