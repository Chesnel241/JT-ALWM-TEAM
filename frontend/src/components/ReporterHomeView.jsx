import { useEffect, useState } from 'react';
import {
  Upload, Download, Mic, Mic2, ListOrdered, ChevronRight, MessageCircle, Bell,
  ArrowRight, RefreshCw, AlertCircle, Clock, Check, Film, Hourglass, FileUp,
} from 'lucide-react';
import { useI18n } from '../i18n/I18nContext.jsx';
import { whatsappSupportLink } from '../lib/support.js';
import { api } from '../api/index.js';
import { etapesParcours } from '../lib/parcours.js';
import NotificationToggle from './NotificationToggle.jsx';
import TextSizeToggle from './TextSizeToggle.jsx';
import CountryAvatar from './CountryAvatar.jsx';
import CountdownTimer from './CountdownTimer.jsx';
import { formatExpiry } from '../lib/dates.js';

/**
 * Accueil de l'espace journalistes (URL /journalistes).
 *
 * Beaucoup de correspondants sont âgés ou peu à l'aise avec le web, et
 * arrivent depuis un lien WhatsApp sur téléphone. L'écran se lit donc de
 * haut en bas, comme une histoire :
 *
 * 1. **leur pays**, drapeau en grand, et le bouton vert pour y entrer ;
 * 2. **le temps qui reste**, en couleur (CountdownTimer) ;
 * 3. **où ils en sont** : leurs fichiers, leur voix off, le JT — trois
 *    étapes reliées par un trait qui se remplit (lib/parcours.js) ;
 * 4. **ce qu'ils peuvent faire**, en trois grandes cartes. Une couleur par
 *    nature d'action, toujours la même : vert pour envoyer, rouge pour
 *    enregistrer (le point « REC »), bleu pour regarder et télécharger,
 *    orange pour corriger.
 *
 * Les rubriques de la rédaction (conducteur, Mot du JT) restent en retrait :
 * un correspondant du Gabon ne les ouvre jamais. Aucune numérotation : la
 * voix off est facultative, et le JT arrive quand la rédaction le publie.
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
  const { t, lang } = useI18n();
  const r = t.reporter;
  const week = weeks.find((w) => w.id === selectedWeek) || null;
  const status = useCountryWeekStatus(homeCountry?.id, selectedWeek);
  const livraisons = useLivraisons(selectedWeek);
  const parcours = etapesParcours({ fichiers: status.files, livraisons });
  const jtPret = livraisons.length > 0;

  const envoi = [
    {
      key: 'reports',
      ton: 'vert',
      Icon: Upload,
      anim: 'jr-anim-monte',
      title: r.uploadTitle,
      text: r.uploadText,
      cta: r.uploadCta,
      onClick: onOpenReports,
    },
    {
      key: 'voixoff',
      ton: 'rouge',
      Icon: Mic,
      egaliseur: true,
      title: r.voixOffTitle,
      text: r.voixOffText,
      cta: r.voixOffCta,
      rec: true,
      onClick: onOpenVoixOff,
    },
    {
      key: 'delivery',
      ton: 'bleu',
      Icon: Download,
      anim: 'jr-anim-descend',
      title: r.downloadTitle,
      text: r.downloadText,
      cta: r.downloadCta,
      nouveau: jtPret,
      onClick: onOpenDelivery,
    },
  ];

  // Le travail d'une ou deux personnes à la rédaction. On garde la porte
  // ouverte — elles passent aussi par cet accueil — sans la mettre sur le
  // chemin des correspondants, qui n'ont rien à y faire.
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
      icon: 'bg-[var(--accent-soft)] text-[color:var(--ink)]',
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-10 space-y-5 sm:space-y-7">
      <header className="jr-ciel text-center px-4 py-6 sm:py-10">
        <span className="badge bg-[var(--paper)] text-[color:var(--accent-deep)] shadow-sm">
          {r.badge}
        </span>
        <h2 className="mt-4 text-2xl sm:text-4xl font-extrabold text-[color:var(--ink)] leading-tight">
          {r.title}
        </h2>
        <p className="mt-3 text-base sm:text-lg text-[color:var(--muted)] max-w-xl mx-auto">
          {r.subtitle}
        </p>
      </header>

      {homeCountry && (
        <section className="jr-pays p-5 sm:p-7 motion-rise" aria-label={r.votrePays}>
          <div className="flex items-center gap-4 sm:gap-6">
            <span className="jr-drapeau">
              <CountryAvatar country={homeCountry} ring className="w-20 h-20 sm:w-24 sm:h-24" />
            </span>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-xs font-bold uppercase tracking-wider text-[color:var(--accent-deep)]">
                {r.votrePays}
              </p>
              <p className="mt-0.5 text-2xl sm:text-3xl font-extrabold text-[color:var(--ink)] leading-tight">
                {homeCountry.name}
              </p>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                {homeCountryConfirmed ? r.myCountryTitle(homeCountry.name) : r.myCountryQuestion(homeCountry.name)}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onContinueWithCountry?.(homeCountry)}
            className="mt-5 w-full inline-flex items-center justify-center gap-2 min-h-[60px] px-5 py-4 rounded-2xl bg-[var(--action)] text-white font-extrabold text-lg shadow-lg shadow-[var(--action)]/25 active:scale-[0.98] motion-tap focus:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--action)]/40"
          >
            <span>{homeCountryConfirmed ? r.myCountryContinue(homeCountry.name) : r.myCountryYes}</span>
            <ArrowRight size={22} />
          </button>
          <p className="mt-2 text-center text-xs text-[color:var(--muted)]">{r.myCountryHint}</p>

          {/* Sortie de secours toujours visible : poste partagé en rédaction,
              clic d'exploration, correspondant qui couvre deux pays. */}
          <button
            type="button"
            onClick={() => onChangeCountry?.()}
            className="mt-1 w-full px-4 py-3 rounded-2xl text-sm font-semibold text-[color:var(--accent-deep)] underline underline-offset-2 active:scale-[0.98]"
          >
            {r.myCountryChange}
          </button>
        </section>
      )}

      {homeCountry && week && <CountdownTimer week={week} ancre={null} />}

      {homeCountry && !status.error && (
        <Parcours
          parcours={parcours}
          status={status}
          week={week}
          r={r}
          t={t}
          lang={lang}
          onOpenReports={onOpenReports}
          onOpenVoixOff={onOpenVoixOff}
          onOpenDelivery={onOpenDelivery}
        />
      )}

      <section aria-labelledby="hub-envoi">
        <div className="mb-3 sm:mb-4 text-left">
          <h3 id="hub-envoi" className="text-lg sm:text-xl font-extrabold text-[color:var(--ink)]">
            {t.hub.envoiTitre}
          </h3>
          <p className="text-sm text-[color:var(--muted)]">{t.hub.envoiSous}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5 motion-stagger">
          {envoi.map(({ key, ton, Icon, anim, egaliseur, title, text, cta, rec, nouveau, onClick }, index) => (
            <button
              key={key}
              type="button"
              data-ton={ton}
              style={{ '--i': index }}
              onClick={onClick}
              className="jr-carte group w-full text-left p-5 sm:p-7 focus:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--accent)]/40 flex flex-col gap-4"
            >
              {nouveau && <span className="jr-nouveau">{r.parcours.pret}</span>}
              <span className={`jr-carte-icone ${anim || ''}`} aria-hidden="true">
                <Icon size={32} strokeWidth={2.2} />
                {egaliseur && <span className="jr-egaliseur"><i /><i /><i /></span>}
              </span>

              <span className="flex-1">
                <span className="block text-xl sm:text-2xl font-extrabold text-[color:var(--ink)] leading-snug">
                  {title}
                </span>
                <span className="mt-1.5 block text-sm sm:text-base text-[color:var(--muted)] leading-relaxed">
                  {text}
                </span>
              </span>

              <span className="jr-cta">
                {rec && <span className="jr-rec" aria-hidden="true" />}
                <span>{cta}</span>
                <ChevronRight size={20} aria-hidden="true" />
              </span>
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="hub-redaction">
        <div className="mb-3 text-left">
          <h3 id="hub-redaction" className="text-base sm:text-lg font-bold text-[color:var(--muted)]">
            {t.hub.redactionTitre}
          </h3>
          <p className="text-sm text-[color:var(--muted)]">{t.hub.redactionSous}</p>
        </div>

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
      <div className="p-5 sm:p-6 rounded-3xl bg-[var(--paper)] border border-[var(--border)] flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-start gap-3 flex-1 text-left">
          <span className="h-11 w-11 shrink-0 rounded-2xl bg-[var(--accent)]/10 text-[color:var(--accent-deep)] flex items-center justify-center">
            <Bell size={22} />
          </span>
          <div className="min-w-0">
            <p className="font-bold text-[color:var(--ink)]">{r.notifyTitle}</p>
            <p className="text-sm text-[color:var(--muted)] mt-0.5">{r.notifyText}</p>
          </div>
        </div>
        <div className="shrink-0 sm:self-center flex flex-wrap items-center gap-2">
          <NotificationToggle audience="reporter" countryId={homeCountry?.id || ''} />
          {/* Le même réglage existe dans l'en-tête, réduit à une icône sur
              téléphone : ici il est nommé, là où on prend le temps de lire. */}
          <TextSizeToggle size={textSize} onChange={onTextSize} />
        </div>
      </div>

      <div className="p-5 sm:p-6 rounded-3xl bg-[var(--paper-2)] border border-[var(--border)] flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 text-left">
          <p className="font-bold text-[color:var(--ink)]">{r.helpTitle}</p>
          <p className="text-sm text-[color:var(--muted)] mt-1">{r.helpText}</p>
        </div>
        <a
          href={whatsappSupportLink(r.helpMessage)}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center justify-center gap-2 min-h-[52px] px-5 py-3.5 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold text-sm shadow-sm active:scale-95 motion-tap"
        >
          <MessageCircle size={18} />
          {r.helpCta}
        </a>
      </div>
    </div>
  );
}

/**
 * Les envois du pays pour la semaine. Sans compte utilisateur, c'est la
 * seule façon de dire au correspondant « votre reportage est bien arrivé »
 * sans qu'il ait à fouiller l'application.
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
        // L'accueil doit rester utilisable hors ligne : on montre les cartes
        // sans état plutôt qu'un message d'erreur anxiogène.
        setState({ loading: false, files: [], error: true });
      });
    return () => { alive = false; };
  }, [countryId, weekId]);

  const { files } = state;
  return {
    ...state,
    total: files.length,
    rejected: files.filter((f) => f && f.status === 'rejected'),
    approved: files.filter((f) => f && f.status === 'approved'),
  };
}

/** Le JT publié pour la semaine, s'il l'est. Silencieux en cas d'échec. */
function useLivraisons(weekId) {
  const [livraisons, setLivraisons] = useState([]);
  useEffect(() => {
    if (!weekId || typeof api.getDeliveries !== 'function') {
      setLivraisons([]);
      return undefined;
    }
    let alive = true;
    Promise.resolve()
      .then(() => api.getDeliveries(weekId))
      .then((liste) => { if (alive) setLivraisons(Array.isArray(liste) ? liste : []); })
      .catch(() => { if (alive) setLivraisons([]); });
    return () => { alive = false; };
  }, [weekId]);
  return livraisons;
}

const ICONES_ETAPES = { reportage: FileUp, voixOff: Mic, jt: Film };

/** Trois étapes reliées : vos fichiers, votre voix off, le JT. */
function Parcours({ parcours, status, week, r, t, lang, onOpenReports, onOpenVoixOff, onOpenDelivery }) {
  const p = r.parcours;
  const ouvrir = { reportage: onOpenReports, voixOff: onOpenVoixOff, jt: onOpenDelivery };
  const titres = { reportage: p.reportage, voixOff: p.voixOff, jt: p.jt };

  const legende = (etape) => {
    if (etape.cle === 'reportage') {
      if (status.loading) return r.statusLoading;
      if (etape.etat === 'aCorriger') return r.statusRejected(etape.nombre);
      if (etape.etat === 'fait') {
        return status.approved.length > 0
          ? `${r.statusSent(etape.nombre)} · ${r.statusApproved(status.approved.length)}`
          : r.statusSent(etape.nombre);
      }
      return p.aFaire;
    }
    if (etape.cle === 'voixOff') return etape.etat === 'fait' ? p.voixEnvoyee(etape.nombre) : p.facultatif;
    return etape.etat === 'pret' ? p.pret : p.enAttente;
  };

  const icone = (etape) => {
    if (status.loading && etape.cle === 'reportage') return RefreshCw;
    if (etape.etat === 'fait') return Check;
    if (etape.etat === 'aCorriger') return AlertCircle;
    if (etape.etat === 'enAttente') return Hourglass;
    if (etape.etat === 'pret') return Download;
    return ICONES_ETAPES[etape.cle];
  };

  return (
    <section className="rounded-[1.75rem] bg-[var(--paper)] border border-[var(--border)] p-5 sm:p-7 shadow-sm" aria-labelledby="hub-parcours">
      <h3 id="hub-parcours" className="text-lg sm:text-xl font-extrabold text-[color:var(--ink)]">
        {p.titre}
      </h3>

      <div className="jr-parcours mt-9">
        <span className="jr-trait" aria-hidden="true">
          <i style={{ '--r': parcours.remplissage }} />
        </span>
        {parcours.etapes.map((etape) => {
          const Icone = icone(etape);
          const aVous = parcours.aVous === etape.cle;
          return (
            <button
              key={etape.cle}
              type="button"
              onClick={ouvrir[etape.cle]}
              className="jr-etape focus:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--accent)]/40"
              data-etat={etape.etat}
              data-avous={aVous ? '' : undefined}
            >
              <span className="jr-noeud" aria-hidden="true">
                {aVous && <span className="jr-avous">{p.aVous}</span>}
                <Icone size={26} strokeWidth={2.4} className={status.loading && etape.cle === 'reportage' ? 'animate-spin' : ''} />
              </span>
              <span className="text-sm font-extrabold text-[color:var(--ink)] leading-tight">{titres[etape.cle]}</span>
              <span className={`text-xs font-semibold leading-snug ${etape.etat === 'aCorriger' ? 'text-[color:var(--cta-orange-deep)]' : 'text-[color:var(--muted)]'}`}>
                {legende(etape)}
              </span>
            </button>
          );
        })}
      </div>

      {status.rejected.length > 0 && (
        <button
          type="button"
          onClick={onOpenReports}
          className="mt-6 w-full flex items-center justify-between gap-3 rounded-2xl bg-[var(--cta-orange)] text-white px-4 py-3.5 font-bold active:scale-[0.99] motion-tap"
        >
          <span className="flex items-center gap-2 text-left">
            <AlertCircle size={20} className="shrink-0" />
            {r.statusRejected(status.rejected.length)}
          </span>
          <span className="flex items-center gap-1 text-sm underline underline-offset-2 shrink-0">
            {r.statusRejectedCta}
            <ChevronRight size={16} />
          </span>
        </button>
      )}

      {week?.expiresAt && (
        <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-[color:var(--muted)]">
          <Clock size={13} className="shrink-0" />
          {t.home.retentionOn(formatExpiry(week, lang))}
        </p>
      )}
    </section>
  );
}
