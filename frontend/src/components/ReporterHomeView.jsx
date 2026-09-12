import { useEffect, useState } from 'react';
import {
  Upload, Download, Mic, Mic2, ListOrdered, ChevronRight, MessageCircle, Bell,
  ArrowRight, RefreshCw, CheckCircle, AlertCircle, Clock,
} from 'lucide-react';
import { useI18n } from '../i18n/I18nContext.jsx';
import { whatsappSupportLink } from '../lib/support.js';
import { api } from '../api/index.js';
import { splitByMediaType } from '../lib/mediaTypes.js';
import NotificationToggle from './NotificationToggle.jsx';
import TextSizeToggle from './TextSizeToggle.jsx';
import CountryAvatar from './CountryAvatar.jsx';
import CountdownTimer from './CountdownTimer.jsx';
import { formatExpiry } from '../lib/dates.js';

/**
 * Accueil de l'espace journalistes (URL /journalistes). L'écran sépare deux
 * gestes qui n'appartiennent pas aux mêmes personnes : ce qu'un correspondant
 * envoie chaque semaine (reportage, voix off, JT à récupérer) et ce que
 * fabrique la rédaction (conducteur, Mot du JT). Les secondes restent
 * accessibles, mais en retrait : un correspondant du Gabon ne les ouvre
 * jamais.
 *
 * Aucune numérotation : elle annonçait une séquence qui n'existe pas. On fait
 * la première carte, parfois la dernière, et jamais celles de la rédaction.
 *
 * Beaucoup de correspondants sont peu à l'aise avec le web et arrivent depuis
 * un lien WhatsApp sur mobile — d'où des cibles tactiles très larges (carte
 * cliquable entière) et un libellé par action.
 */
export default function ReporterHomeView({
  onOpenReports,
  onOpenVoixOff,
  onOpenDelivery,
  onOpenConducteur,
  onOpenMotDuJt,
  homeCountry = null,
  homeCountryConfirmed = false,
  onContinueWithCountry,
  onChangeCountry,
  weeks = [],
  selectedWeek = '',
  textSize,
  onTextSize,
}) {
  const { t } = useI18n();
  const r = t.reporter;
  const week = weeks.find((w) => w.id === selectedWeek) || null;
  const status = useCountryWeekStatus(homeCountry?.id, selectedWeek);

  // Le geste hebdomadaire du correspondant : c'est pour ces trois cartes
  // qu'il ouvre l'application, donc elles occupent la place.
  const envoi = [
    {
      key: 'reports',
      Icon: Upload,
      title: r.uploadTitle,
      text: r.uploadText,
      cta: r.uploadCta,
      onClick: onOpenReports,
      tone: {
        card: 'border-[color:var(--accent)]/40 hover:border-[color:var(--accent)]',
        icon: 'bg-[var(--accent)] text-white',
        cta: 'bg-[var(--action)] text-white shadow-md shadow-[var(--action)]/25',
      },
    },
    {
      key: 'voixoff',
      Icon: Mic,
      title: r.voixOffTitle,
      text: r.voixOffText,
      cta: r.voixOffCta,
      onClick: onOpenVoixOff,
      tone: {
        card: 'border-purple-300 dark:border-purple-800/40 hover:border-purple-500',
        icon: 'bg-purple-600 text-white',
        cta: 'bg-[var(--action)] text-white shadow-md shadow-[var(--action)]/25',
      },
    },
    {
      key: 'delivery',
      Icon: Download,
      title: r.downloadTitle,
      text: r.downloadText,
      cta: r.downloadCta,
      onClick: onOpenDelivery,
      tone: {
        card: 'border-[var(--border)] hover:border-[color:var(--accent-soft)]',
        icon: 'bg-[var(--accent-soft)] text-[#111827]',
        cta: 'bg-[var(--action)] text-white shadow-md shadow-[var(--action)]/25',
      },
    },
  ];

  // Le travail d'une ou deux personnes à la rédaction. On garde la porte
  // ouverte — elles passent aussi par cet accueil — sans la mettre sur le
  // chemin des quinze correspondants qui n'ont rien à y faire.
  const redaction = [
    {
      key: 'conducteur',
      Icon: ListOrdered,
      title: t.rubriques.conducteurTitre,
      text: t.rubriques.conducteurTexte,
      cta: t.rubriques.conducteurCta,
      onClick: onOpenConducteur,
      icon: 'bg-[var(--accent-deep)] text-white',
    },
    {
      key: 'motDuJt',
      Icon: Mic2,
      title: t.rubriques.motDuJtTitre,
      text: t.rubriques.motDuJtTexte,
      cta: t.rubriques.motDuJtCta,
      onClick: onOpenMotDuJt,
      icon: 'bg-[var(--accent-soft)] text-[#111827]',
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

      {homeCountry && (
        <div className="mb-4 sm:mb-6 rounded-3xl border-2 border-[color:var(--accent)]/40 bg-[var(--paper)] p-5 sm:p-6 shadow-sm">
          <div className="flex items-center gap-3 sm:gap-4">
            <CountryAvatar country={homeCountry} className="w-12 h-12 sm:w-14 sm:h-14 shrink-0" />
            <div className="min-w-0 flex-1 text-left">
              <p className="font-bold text-base sm:text-lg text-[color:var(--ink)] leading-snug">
                {homeCountryConfirmed
                  ? r.myCountryTitle(homeCountry.name)
                  : r.myCountryQuestion(homeCountry.name)}
              </p>
              <p className="text-sm text-[color:var(--muted)] mt-0.5">{r.myCountryHint}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onContinueWithCountry?.(homeCountry)}
            className="mt-4 w-full inline-flex items-center justify-center gap-2 px-5 py-4 rounded-2xl bg-[var(--action)] text-white font-bold text-base shadow-md shadow-[var(--action)]/25 active:scale-[0.98] motion-tap focus:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--action)]/40"
          >
            <span>
              {homeCountryConfirmed
                ? r.myCountryContinue(homeCountry.name)
                : r.myCountryYes}
            </span>
            <ArrowRight size={20} />
          </button>

          {/* Sortie de secours toujours visible : poste partagé en rédaction,
              clic d'exploration, correspondant qui couvre deux pays. */}
          <button
            type="button"
            onClick={() => onChangeCountry?.()}
            className="mt-2 w-full px-4 py-3 rounded-2xl text-sm font-semibold text-[color:var(--accent-deep)] underline underline-offset-2 active:scale-[0.98]"
          >
            {r.myCountryChange}
          </button>

          <ReporterWeekStatus status={status} week={week} r={r} onOpenReports={onOpenReports} />
        </div>
      )}

      <section aria-labelledby="hub-envoi">
        <div className="mb-3 sm:mb-4 text-left">
          <h3 id="hub-envoi" className="text-lg sm:text-xl font-bold text-[color:var(--ink)]">
            {t.hub.envoiTitre}
          </h3>
          <p className="text-sm text-[color:var(--muted)]">{t.hub.envoiSous}</p>
        </div>

        {/* Pas de hauteur plancher sur téléphone : imposée aux cartes, elle
            repoussait l'aide WhatsApp à deux écrans de défilement. */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 motion-stagger">
          {envoi.map(({ key, Icon, title, text, cta, onClick, tone }, index) => (
            <button
              key={key}
              type="button"
              style={{ '--i': index }}
              onClick={onClick}
              className={`group w-full text-left bg-[var(--paper)] border-2 ${tone.card} rounded-3xl p-5 sm:p-8 shadow-sm motion-tap active:scale-[0.98] sm:hover:shadow-[var(--shadow-soft)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--accent)]/40 flex flex-col gap-3 sm:gap-4 sm:min-h-[280px]`}
            >
              <div className={`h-14 w-14 sm:h-20 sm:w-20 rounded-2xl flex items-center justify-center ${tone.icon}`}>
                <Icon size={30} strokeWidth={2.2} />
              </div>

              <div className="flex-1">
                <h4 className="text-xl sm:text-2xl font-bold text-[color:var(--ink)] leading-snug">
                  {title}
                </h4>
                <p className="mt-1.5 sm:mt-2 text-sm sm:text-base text-[color:var(--muted)] leading-relaxed">
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
      </section>

      <section aria-labelledby="hub-redaction" className="mt-8 sm:mt-10">
        <div className="mb-3 text-left">
          <h3 id="hub-redaction" className="text-base sm:text-lg font-bold text-[color:var(--muted)]">
            {t.hub.redactionTitre}
          </h3>
          <p className="text-sm text-[color:var(--muted)]">{t.hub.redactionSous}</p>
        </div>

        {/* Même largeur de colonne que les cartes d'envoi, mais en rangée :
            le titre suffit à reconnaître la rubrique quand on la cherche. */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {redaction.map(({ key, Icon, title, text, cta, onClick, icon }) => (
            <button
              key={key}
              type="button"
              onClick={onClick}
              aria-label={cta}
              className="group w-full text-left bg-[var(--paper-2)] border border-[var(--border)] hover:border-[color:var(--accent)] rounded-2xl px-4 py-3 motion-tap active:scale-[0.99] focus:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--accent)]/40 flex items-center gap-3"
            >
              <span className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center ${icon}`}>
                <Icon size={20} strokeWidth={2.2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-[color:var(--ink)] leading-snug">{title}</span>
                <span className="mt-0.5 block text-xs text-[color:var(--muted)] leading-snug line-clamp-2">
                  {text}
                </span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-[color:var(--muted)] transition-transform sm:group-hover:translate-x-1" />
            </button>
          ))}
        </div>
      </section>

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
        <div className="shrink-0 sm:self-center flex items-center gap-2">
          <NotificationToggle audience="reporter" countryId={homeCountry?.id || ''} />
          {/* Le même réglage existe dans l'en-tête, réduit à une icône sur
              téléphone : ici il est nommé, là où on prend le temps de lire. */}
          <TextSizeToggle size={textSize} onChange={onTextSize} />
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
          className="shrink-0 inline-flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-sm shadow-sm active:scale-95 motion-tap"
        >
          <MessageCircle size={18} />
          {r.helpCta}
        </a>
      </div>
    </div>
  );
}

/**
 * État de la semaine pour un pays : ce qui est parti, ce qui est validé, ce
 * qui est à corriger. Sans compte utilisateur, c'est la seule façon de dire
 * au correspondant « votre reportage est bien arrivé » sans qu'il ait à
 * fouiller l'application.
 */
function useCountryWeekStatus(countryId, weekId) {
  const [state, setState] = useState({ loading: false, files: [], error: false });

  useEffect(() => {
    if (!countryId || !weekId) {
      setState({ loading: false, files: [], error: false });
      return undefined;
    }
    let alive = true;
    setState((prev) => ({ ...prev, loading: true, error: false }));
    api.getUploads(weekId, countryId)
      .then((files) => {
        if (!alive) return;
        setState({ loading: false, files: Array.isArray(files) ? files : [], error: false });
      })
      .catch(() => {
        if (!alive) return;
        // L'accueil doit rester utilisable hors ligne : on montre les deux
        // boutons sans état plutôt qu'un message d'erreur anxiogène.
        setState({ loading: false, files: [], error: true });
      });
    return () => { alive = false; };
  }, [countryId, weekId]);

  const { files } = state;
  const rejected = files.filter((f) => f && f.status === 'rejected');
  const approved = files.filter((f) => f && f.status === 'approved');
  const byType = splitByMediaType(files);

  return {
    ...state,
    total: files.length,
    rejected,
    approved,
    counts: {
      video: (byType.video || []).length,
      audio: (byType.audio || []).length,
      image: (byType.image || []).length,
      document: (byType.document || []).length,
    },
  };
}

/** Bandeau d'état sous le raccourci pays : échéance, envois, corrections. */
function ReporterWeekStatus({ status, week, r, onOpenReports }) {
  const { t, lang } = useI18n();
  if (!status || status.error) return null;

  const hasRejected = status.rejected.length > 0;

  return (
    <div className="mt-4 pt-4 border-t border-[var(--border)] space-y-3">
      {week && <CountdownTimer week={week} compact />}

      {week?.expiresAt && (
        <p className="flex items-center gap-1.5 text-[11px] text-[color:var(--muted)]">
          <Clock size={12} className="shrink-0" />
          {t.home.retentionOn(formatExpiry(week, lang))}
        </p>
      )}

      {status.loading ? (
        <p className="flex items-center gap-2 text-sm text-[color:var(--muted)]">
          <RefreshCw size={15} className="animate-spin shrink-0" />
          {r.statusLoading}
        </p>
      ) : status.total === 0 ? (
        <p className="flex items-center gap-2 text-sm text-[color:var(--muted)]">
          <Clock size={15} className="shrink-0" />
          {r.statusNone}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
          <span className="flex items-center gap-1.5 font-semibold text-[color:var(--ink)]">
            <CheckCircle size={15} className="shrink-0 text-[color:var(--success)]" />
            {r.statusSent(status.total)}
          </span>
          {status.approved.length > 0 && (
            <span className="text-[color:var(--muted)]">{r.statusApproved(status.approved.length)}</span>
          )}
        </div>
      )}

      {hasRejected && (
        <button
          type="button"
          onClick={onOpenReports}
          className="w-full text-left rounded-2xl border border-[var(--signal)]/40 bg-[var(--signal)]/10 px-4 py-3 active:scale-[0.99] transition-transform"
        >
          <span className="flex items-center gap-2 font-bold text-sm text-[var(--signal)]">
            <AlertCircle size={16} className="shrink-0" />
            {r.statusRejected(status.rejected.length)}
          </span>
          <span className="mt-0.5 block text-xs font-semibold text-[color:var(--ink)] underline underline-offset-2">
            {r.statusRejectedCta}
          </span>
        </button>
      )}
    </div>
  );
}
