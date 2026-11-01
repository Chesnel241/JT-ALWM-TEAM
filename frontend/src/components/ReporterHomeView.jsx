import { useState } from 'react';
import { Mic, Download, ArrowRight, MessageCircle, Bell, Type, CalendarDays } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext.jsx';
import { whatsappSupportLink } from '../lib/support.js';
import { formatWeekFull } from '../lib/dates.js';
import { aDuNouveau } from '../lib/jtVus.js';
import { useLivraisons } from '../hooks/useLivraisons.js';
import NotificationToggle from './NotificationToggle.jsx';
import TextSizeToggle from './TextSizeToggle.jsx';
import CountdownTimer from './CountdownTimer.jsx';
import RedactionJournal from './RedactionJournal.jsx';
import GrillePays, { RecherchePays } from './GrillePays.jsx';

/**
 * Accueil de l'espace journalistes (URL /journalistes).
 *
 * On arrive, et tout est là d'un coup d'œil, de haut en bas :
 *
 * 1. **la semaine** et le temps qui reste, dans l'heure de l'appareil ;
 * 2. **les accès rapides** : la voix off (rouge), le JT (bleu), et la
 *    rédaction du journal — le conducteur et le Mot du JT, présentés comme
 *    un conducteur de télévision avec l'état de chaque pièce ;
 * 3. **les drapeaux** : chaque correspondant touche le sien et entre dans
 *    son espace ;
 * 4. le confort de lecture et l'aide.
 *
 * L'accueil ne devine plus le pays de la personne : l'accès se fait sans
 * compte, et « le dernier pays ouvert » sur un appareil ne disait rien de
 * qui arrivait. Le suivi d'un pays (vos fichiers, votre voix off, le JT) est
 * dans l'espace du pays, où le pays est connu par l'adresse.
 */

// Au-delà, la grille des drapeaux devient longue : une recherche aide. En
// deçà, un champ de recherche fait surgir le clavier, cache la moitié des
// drapeaux, et laisse croire qu'il faut le remplir.
const SEUIL_RECHERCHE = 15;

function TuileAcces({ ton, Icone, anim, titre, statut, badge, index, onClick, className = '' }) {
  return (
    <button
      type="button"
      data-ton={ton}
      data-anim={anim}
      style={{ '--i': index }}
      onClick={onClick}
      className={`jr-acces focus:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--accent)]/40 ${className}`}
    >
      {badge && <span className="jr-nouveau">{badge}</span>}
      <span className="jr-acces-icone" aria-hidden="true">
        <Icone size={26} strokeWidth={2.3} />
        {anim === 'onde' && <span className="jr-egaliseur"><i /><i /><i /></span>}
      </span>
      <span className="jr-acces-titre">{titre}</span>
      <span className="jr-acces-statut">{statut}</span>
      <span className="jr-acces-fleche" aria-hidden="true">
        <ArrowRight size={18} strokeWidth={2.6} />
      </span>
    </button>
  );
}

export default function ReporterHomeView({
  countries = [],
  onSelectCountry,
  onCountryAdded,
  onOpenVoixOff,
  onOpenDelivery,
  onOpenConducteur,
  onOpenMotDuJt,
  weeks = [],
  selectedWeek = '',
  textSize,
  onTextSize,
  isActive = true,
}) {
  const { t, lang } = useI18n();
  const r = t.reporter;
  const h = t.hub;
  const [requete, setRequete] = useState('');
  const week = weeks.find((w) => w.id === selectedWeek) || weeks.find((w) => w.status === 'active') || null;
  const livraisons = useLivraisons(week?.id);
  const jtPret = livraisons.length > 0;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-7 sm:space-y-9">
      <header className="jr-ciel px-4 py-5 sm:px-8 sm:py-7">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] lg:items-center">
          <div className="text-center lg:text-left motion-rise">
            {/* Sur téléphone, l'en-tête dit déjà « Journalistes ». */}
            <span className="badge hidden sm:inline-flex bg-[var(--paper)] text-[color:var(--accent-deep)] shadow-sm">{r.badge}</span>
            <h2 className="sm:mt-3 text-2xl sm:text-4xl font-extrabold text-[color:var(--ink)] leading-tight">{r.title}</h2>
            {week && (
              <p className="mt-2 inline-flex items-center gap-2 text-sm sm:text-base font-semibold text-[color:var(--muted)]">
                <CalendarDays size={17} className="shrink-0 text-[color:var(--accent)]" aria-hidden="true" />
                {formatWeekFull(week, lang)}
              </p>
            )}
          </div>
          {week && <CountdownTimer week={week} compact ancre={null} />}
        </div>
      </header>

      <section aria-labelledby="hub-acces">
        <h3 id="hub-acces" className="jr-section-titre">{h.accesTitre}</h3>
        {/* Téléphone : voix off et JT côte à côte, la rédaction dessous.
            Ordinateur : voix off et JT l'un sur l'autre, la rédaction à
            côté, sur deux colonnes — les trois blocs ont la même hauteur. */}
        <div className="mt-3 grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 motion-stagger">
          <TuileAcces
            className="lg:col-start-1 lg:row-start-1"
            index={0}
            ton="rouge"
            Icone={Mic}
            anim="onde"
            titre={r.voixOffTitle}
            statut={h.voixOffStatut}
            onClick={onOpenVoixOff}
          />
          <TuileAcces
            className="lg:col-start-1 lg:row-start-2"
            index={1}
            ton="bleu"
            Icone={Download}
            anim="descend"
            titre={r.downloadTitle}
            statut={jtPret ? r.parcours.pret : r.parcours.enAttente}
            badge={jtPret && aDuNouveau(livraisons) ? t.jtPret.nouveau : null}
            onClick={onOpenDelivery}
          />
          <div className="col-span-2 lg:col-start-2 lg:row-start-1 lg:row-span-2" style={{ '--i': 2 }}>
            <RedactionJournal
              week={week}
              actif={isActive}
              onOpenConducteur={onOpenConducteur}
              onOpenMotDuJt={onOpenMotDuJt}
            />
          </div>
        </div>
      </section>

      <section aria-labelledby="hub-envoi">
        <h3 id="hub-envoi" className="jr-section-titre">{h.envoiTitre}</h3>
        <p className="mt-1 text-sm sm:text-base text-[color:var(--muted)]">{h.envoiSous}</p>
        {countries.length > SEUIL_RECHERCHE && (
          <div className="mt-4 max-w-xl">
            <RecherchePays valeur={requete} onChange={setRequete} />
          </div>
        )}
        <div className="mt-4">
          <GrillePays
            countries={countries}
            requete={requete}
            onSelectCountry={onSelectCountry}
            onCountryAdded={onCountryAdded}
            variante="compacte"
          />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 md:items-start" aria-label={h.confortTitre}>
        <div className="jr-confort">
          <p className="jr-section-titre !text-base">{h.confortTitre}</p>
          {/* Seulement là où les notifications sont possibles : ailleurs, la
              ligne disparaît au lieu d'afficher un bouton mort. */}
          <NotificationToggle
            audience="reporter"
            cadre={(bouton) => (
              <div className="jr-confort-ligne">
                <span className="jr-confort-icone" aria-hidden="true"><Bell size={20} /></span>
                <span className="min-w-0">
                  <span className="block font-bold text-[color:var(--ink)]">{r.notifyTitle}</span>
                  <span className="block text-sm text-[color:var(--muted)]">{r.notifyText}</span>
                </span>
                <span className="jr-confort-reglage">{bouton}</span>
              </div>
            )}
          />
          <div className="jr-confort-ligne">
            <span className="jr-confort-icone" aria-hidden="true"><Type size={20} /></span>
            <span className="min-w-0">
              <span className="block font-bold text-[color:var(--ink)]">{h.texteTitre}</span>
              <span className="block text-sm text-[color:var(--muted)]">{h.texteTexte}</span>
            </span>
            <span className="jr-confort-reglage">
              <TextSizeToggle size={textSize} onChange={onTextSize} />
            </span>
          </div>
        </div>

        <div className="jr-aide">
          <span className="jr-aide-bulle" aria-hidden="true"><MessageCircle size={26} /></span>
          <div className="min-w-0">
            <p className="text-lg font-extrabold text-[color:var(--ink)]">{r.helpTitle}</p>
            <p className="mt-1 text-sm text-[color:var(--muted)]">{r.helpText}</p>
          </div>
          <a
            href={whatsappSupportLink(r.helpMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className="jr-bouton jr-bouton-vert w-full sm:w-auto"
          >
            <MessageCircle size={18} aria-hidden="true" />
            {r.helpCta}
          </a>
        </div>
      </section>
    </div>
  );
}
