import { useEffect, useId, useState } from 'react';
import { ListOrdered, Video, ChevronRight, Check } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext.jsx';
import { api } from '../api/index.js';
import { formatRelative, formatWeekLabel } from '../lib/dates.js';
import { etatRedaction, avancementRedaction } from '../lib/redaction.js';

/**
 * La rédaction du journal, vue comme son conducteur.
 *
 * Le conducteur d'un JT est une liste numérotée d'éléments, chacun avec son
 * état. La carte reprend cette forme : « 01 Conducteur du JT » et « 02 Mot
 * du JT », chacune avec ses pièces (texte, voix off, vidéo, orateur…)
 * cochées quand elles sont là, et une jauge pour la semaine.
 *
 * C'était une liste grise en bas de l'accueil, sous la ligne de flottaison :
 * le rédacteur en chef devait la chercher, puis ouvrir chaque rubrique pour
 * savoir ce qui manquait. Elle est maintenant dans les accès rapides, et dit
 * d'un coup d'œil ce qui est prêt. Sur téléphone, les deux rubriques
 * deviennent deux tuiles côte à côte, pour laisser les drapeaux à l'écran.
 */

// Les rubriques se lisent après le premier affichage : sur une 4G faible,
// les drapeaux et les accès rapides passent d'abord.
function plusTard(rappel) {
  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(rappel, { timeout: 1500 });
    return () => window.cancelIdleCallback?.(id);
  }
  const id = setTimeout(rappel, 250);
  return () => clearTimeout(id);
}

/** Les rubriques et leurs fichiers, relus chaque fois qu'on revient. */
function useEtatRedaction(weekId, actif) {
  const [donnees, setDonnees] = useState({ chargement: true, etat: etatRedaction() });

  useEffect(() => {
    if (!weekId || !actif) return undefined;
    let vivant = true;
    const sans = (lire) => Promise.resolve().then(lire).catch(() => null);
    const annuler = plusTard(() => {
      Promise.all([
        sans(() => api.getRubriques(weekId)),
        sans(() => api.getUploads(weekId, 'tj')),
        sans(() => api.getUploads(weekId, 'mj')),
      ]).then(([rubriques, fichiersConducteur, fichiersMot]) => {
        if (!vivant) return;
        setDonnees({ chargement: false, etat: etatRedaction({ rubriques, fichiersConducteur, fichiersMot }) });
      });
    });
    return () => {
      vivant = false;
      annuler();
    };
  }, [weekId, actif]);

  return donnees;
}

export default function RedactionJournal({ week, actif = true, onOpenConducteur, onOpenMotDuJt }) {
  const { t, lang } = useI18n();
  const x = t.redaction;
  const base = useId();
  const { chargement, etat } = useEtatRedaction(week?.id, actif);
  const avancement = avancementRedaction(etat);
  const connu = !chargement && !etat.inconnu;
  const global = !connu ? 'inconnu' : avancement.faits === avancement.total ? 'pret' : avancement.faits === 0 ? 'vide' : 'partiel';

  const lignes = [
    {
      cle: 'conducteur',
      numero: '01',
      Icone: ListOrdered,
      titre: t.rubriques.conducteurTitre,
      aria: t.rubriques.conducteurCta,
      detail: etat.conducteur.majLe ? x.modifie(formatRelative(etat.conducteur.majLe, lang)) : t.rubriques.conducteurTexte,
      rubrique: etat.conducteur,
      onClick: onOpenConducteur,
    },
    {
      cle: 'motDuJt',
      numero: '02',
      Icone: Video,
      titre: t.rubriques.motDuJtTitre,
      aria: t.rubriques.motDuJtCta,
      detail: etat.motDuJt.orateur ? x.avec(etat.motDuJt.orateur) : t.rubriques.motDuJtTexte,
      rubrique: etat.motDuJt,
      onClick: onOpenMotDuJt,
    },
  ];

  return (
    <section className="jr-redaction" data-etat={global} aria-labelledby={`${base}-titre`}>
      <div className="jr-redaction-tete">
        <div className="min-w-0">
          <p className="jr-redaction-surtitre">
            <span className="jr-redaction-voyant" aria-hidden="true" />
            {x.surtitre(week ? formatWeekLabel(week, lang) : '')}
          </p>
          <h3 id={`${base}-titre`} className="mt-1 text-lg sm:text-xl font-extrabold text-[color:var(--ink)] leading-tight">
            {t.hub.redactionTitre}
          </h3>
          <p className="hidden sm:block mt-0.5 text-sm text-[color:var(--muted)]">{t.hub.redactionSous}</p>
        </div>
        {connu && (
          <div className="jr-redaction-avancement">
            <span className="text-sm font-extrabold text-[color:var(--ink)]">
              {x.progression(avancement.faits, avancement.total)}
            </span>
            <span className="jr-redaction-jauge" aria-hidden="true">
              <i style={{ '--p': avancement.part }} />
            </span>
          </div>
        )}
      </div>

      <ol className="jr-conducteur">
        {lignes.map(({ cle, numero, Icone, titre, aria, detail, rubrique, onClick }) => {
          const etatLigne = connu ? rubrique.etat : 'inconnu';
          return (
            <li key={cle}>
              <button
                type="button"
                onClick={onClick}
                aria-label={aria}
                aria-describedby={`${base}-${cle}`}
                data-etat={etatLigne}
                className="jr-conducteur-ligne focus:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--accent)]/40"
              >
                <span className="jr-conducteur-num" aria-hidden="true">{numero}</span>
                <span className="jr-conducteur-icone" aria-hidden="true">
                  <Icone size={22} strokeWidth={2.2} />
                </span>
                <span id={`${base}-${cle}`} className="jr-conducteur-texte">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-base sm:text-lg font-extrabold text-[color:var(--ink)] leading-tight">{titre}</span>
                    {connu && <span className="jr-conducteur-statut" data-etat={etatLigne}>{x.etats[etatLigne]}</span>}
                  </span>
                  <span className="jr-conducteur-detail">{detail}</span>
                  {connu && (
                    <>
                      <span className="jr-pieces">
                        {rubrique.elements.map((el) => (
                          <span key={el.cle} className="jr-piece" data-fait={el.fait ? '' : undefined}>
                            <span className="jr-piece-coche" aria-hidden="true">
                              {el.fait && <Check size={11} strokeWidth={3.5} />}
                            </span>
                            {x.elements[el.cle]}
                          </span>
                        ))}
                      </span>
                      {/* Sur téléphone, les pièces deviennent des points. */}
                      <span className="jr-voyants" aria-hidden="true">
                        {rubrique.elements.map((el) => (
                          <i key={el.cle} data-fait={el.fait ? '' : undefined} />
                        ))}
                      </span>
                    </>
                  )}
                </span>
                <ChevronRight size={22} className="jr-conducteur-fleche" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
