import { useCallback, useEffect, useState } from 'react';
import { ListOrdered, Mic2, Copy, Check, ExternalLink } from 'lucide-react';
import { api } from '../api/index.js';
import { useI18n } from '../i18n/I18nContext.jsx';
import { useOptionalToast } from '../hooks/useToast.jsx';
import { formatRelative } from '../lib/dates.js';

/**
 * Le contenu d'une rubrique, lu depuis le chutier de l'espace montage.
 *
 * Les FICHIERS d'une rubrique arrivaient bien jusqu'au monteur — la voix off
 * et la vidéo du Mot du JT sont rangées dans les tiroirs `tj` et `mj`, que le
 * tableau de bord liste. Les TEXTES, eux, n'étaient lisibles que dans l'espace
 * journalistes : il fallait taper l'adresse à la main pour lire le déroulé
 * qu'on est censé monter.
 *
 * Ici, en lecture seule. Le bouton « copier » est le geste réel : on vient
 * chercher le déroulé pour le coller dans son outil de montage. L'écriture
 * reste où elle est écrite — dupliquer l'enregistrement différé et la garde de
 * révision de `RubriqueView` créerait deux chemins à tenir en accord.
 */

const ICONES = { conducteur: ListOrdered, motDuJt: Mic2 };

// L'écran de rédaction correspondant, pour qui veut corriger.
const ADRESSES = { conducteur: '/journalistes/conducteur', motDuJt: '/journalistes/mot-du-jt' };

export default function RubriquePanel({ selectedWeek, bin }) {
  const { t, lang } = useI18n();
  const { addToast } = useOptionalToast();
  const r = t.rubriqueLue;

  const [rubrique, setRubrique] = useState(null);
  const [champs, setChamps] = useState({});
  const [majLe, setMajLe] = useState('');
  const [copie, setCopie] = useState('');

  useEffect(() => {
    if (!selectedWeek || !bin) { setRubrique(null); return undefined; }
    let vivant = true;
    // Le tiroir suffit : la route accepte `tj` comme `conducteur`.
    api.getRubrique(selectedWeek, bin)
      .then((reponse) => {
        if (!vivant) return;
        setRubrique(reponse?.rubrique || null);
        setChamps(reponse?.champs || {});
        setMajLe(reponse?.majLe || '');
      })
      .catch(() => { if (vivant) setRubrique(null); });
    return () => { vivant = false; };
  }, [selectedWeek, bin]);

  const copier = useCallback(async (cleChamp, valeur) => {
    try {
      await navigator.clipboard.writeText(valeur);
      setCopie(cleChamp);
      setTimeout(() => setCopie(''), 2000);
      addToast(r.copieOk, 'success', 2000);
    } catch {
      // Presse-papier refusé (page non sécurisée, réglage du navigateur) :
      // le dire, plutôt que de laisser croire que le texte est copié.
      addToast(r.copieEchec, 'error', 5000);
    }
  }, [addToast, r.copieOk, r.copieEchec]);

  if (!rubrique) return null;

  const Icone = ICONES[rubrique.cle] || ListOrdered;
  const adresse = ADRESSES[rubrique.cle];

  return (
    <section className="border-b border-[var(--border)] bg-[var(--paper)] px-4 py-3.5">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-[color:var(--ink)]">
          <Icone size={16} aria-hidden="true" className="text-[color:var(--accent-deep)]" />
          {rubrique.nom}
        </h2>
        {majLe && (
          <span className="text-xs text-[color:var(--muted)]">
            {t.rubriques.modifieLe(formatRelative(majLe, lang))}
          </span>
        )}
        {adresse && (
          <a
            href={adresse}
            className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-[color:var(--accent-deep)] hover:underline"
          >
            <ExternalLink size={13} aria-hidden="true" />
            {r.modifier}
          </a>
        )}
      </header>

      <dl className="space-y-3">
        {rubrique.champs.map((champ) => {
          const valeur = String(champs[champ.cle] || '').trim();
          return (
            <div key={champ.cle}>
              <dt className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[color:var(--muted)] mb-1">
                {champ.libelle}
                {valeur && (
                  <button
                    type="button"
                    onClick={() => copier(champ.cle, valeur)}
                    className="motion-tap inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-[color:var(--ink)] hover:bg-[var(--paper-2)]"
                  >
                    {copie === champ.cle
                      ? <><Check size={11} aria-hidden="true" /> {r.copie}</>
                      : <><Copy size={11} aria-hidden="true" /> {r.copier}</>}
                  </button>
                )}
              </dt>
              <dd className="m-0">
                {valeur ? (
                  // `pre-wrap` : le conducteur est un déroulé, ses retours à la
                  // ligne portent le rythme du journal.
                  <p className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl border border-[var(--border)] bg-[var(--paper-2)] px-3 py-2 text-sm leading-relaxed text-[color:var(--ink)]">
                    {valeur}
                  </p>
                ) : (
                  <p className="text-sm text-[color:var(--muted)] italic">{r.vide}</p>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
