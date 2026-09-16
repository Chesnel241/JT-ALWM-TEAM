import React, { useEffect, useRef, useState } from 'react';
import TexteJT, { FournitureHabillage } from '../../../../remotion/src/TexteJT.jsx';
import { COULEURS } from '../../../../remotion/src/identite.js';
import { TEXT_ANIMATIONS_IN } from '../../data/overlayTemplates.js';

/**
 * Choisir un mouvement en le voyant, et non en lisant son nom.
 *
 * « Flou », « Saccade », « Rapproché » ne veulent rien dire tant qu'on ne les
 * a pas vus. Le monteur choisissait dans une liste déroulante, générait le
 * master, regardait le MP4, et recommençait. Trois minutes de rendu par essai.
 *
 * Ce que montrent ces aperçus ne peut pas mentir : ils montent `<TexteJT>`,
 * le composant même que le rendu Remotion utilise à l'antenne, avec la même
 * arithmétique d'images (`mouvement.js`). Il n'y a pas de seconde
 * implémentation « pour l'aperçu » qui pourrait diverger — c'est précisément
 * la divergence qui avait laissé trois menus d'animation ne commander rien
 * pendant des mois.
 */

const FPS = 30;
/** Un cycle d'aperçu complet : entrée, pose, sortie. */
const CYCLE = 90;
/** Un cycle court pour les vignettes : l'entrée seule, puis on recommence. */
const CYCLE_VIGNETTE = 48;
/** Au-delà de ce seuil, `mouvement.js` considère la durée comme non bornée. */
const SANS_FIN = 99999;

/**
 * L'image courante d'une boucle d'aperçu.
 *
 * Une seule horloge pour tout le bloc : douze `requestAnimationFrame`
 * indépendants pour douze vignettes feraient battre douze horloges
 * légèrement décalées, et l'œil le voit.
 *
 * `prefers-reduced-motion` fige l'aperçu sur son image de repos plutôt que de
 * l'arrêter au hasard : on voit alors l'état final, qui reste une information
 * utile. C'est la convention posée pour le reste de l'interface.
 */
export function useImageAnimee(total = CYCLE) {
  const [frame, setFrame] = useState(0);
  const depart = useRef(null);

  useEffect(() => {
    const reduit = typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduit) {
      setFrame(Math.round(total * 0.6)); // posé : l'entrée est finie, la sortie pas commencée
      return undefined;
    }
    if (typeof requestAnimationFrame !== 'function') return undefined;

    let vivant = true;
    let demande;
    const battre = (t) => {
      if (!vivant) return;
      if (depart.current == null) depart.current = t;
      setFrame(Math.floor(((t - depart.current) / 1000) * FPS) % total);
      demande = requestAnimationFrame(battre);
    };
    demande = requestAnimationFrame(battre);
    return () => { vivant = false; cancelAnimationFrame(demande); depart.current = null; };
  }, [total]);

  return frame;
}

/**
 * Un texte animé à une image donnée.
 *
 * `FournitureHabillage` prend l'image explicitement : c'est ce qui permet au
 * studio de piloter l'horloge lui-même, sans monter de composition Remotion ni
 * de lecteur vidéo — et donc sans les deux exemplaires de Remotion qui
 * fournissent deux contextes React distincts.
 */
export function ApercuMouvement({
  frame,
  animation = 'fade',
  boucle = 'none',
  sortie = 'auto',
  duree = SANS_FIN,
  mot = 'Texte',
  taille = 15,
}) {
  return (
    <FournitureHabillage
      overlay={{ animation, animationLoop: boucle, animationOut: sortie }}
      durationInFrames={duree}
      frame={frame}
      fps={FPS}
    >
      <TexteJT
        role="titrage"
        style={{
          fontFamily: "'Montserrat ExtraBold', system-ui, sans-serif",
          fontWeight: 800,
          fontSize: `${taille}px`,
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
          color: COULEURS.papier,
          whiteSpace: 'nowrap',
        }}
      >
        {mot}
      </TexteJT>
    </FournitureHabillage>
  );
}

/** Le cadre sombre dans lequel un aperçu se joue, aux proportions de l'antenne. */
function Scene({ children, hauteur = 46 }) {
  return (
    <div
      aria-hidden="true"
      className="w-full rounded-lg overflow-hidden flex items-center justify-center border border-[var(--border)]"
      style={{ height: hauteur, background: COULEURS.fond }}
    >
      {children}
    </div>
  );
}

/**
 * Le grand aperçu : la combinaison réellement choisie, du début à la fin.
 *
 * Entrée, boucle et sortie ensemble, sur le texte que le monteur a tapé.
 * C'est la seule façon de voir qu'une machine à écrire suivie d'un flou
 * sortant ne va pas ensemble — trois listes déroulantes ne le disent pas.
 */
export function ApercuCombinaison({ animation, boucle, sortie, mot }) {
  const frame = useImageAnimee(CYCLE);
  return (
    <Scene hauteur={64}>
      <ApercuMouvement
        frame={frame}
        animation={animation}
        boucle={boucle}
        sortie={sortie}
        duree={CYCLE}
        mot={mot}
        taille={20}
      />
    </Scene>
  );
}

/** Les trois intentions, dans l'ordre où elles se justifient à l'antenne. */
const FAMILLES = [
  { id: 'sobre', label: 'Sobre', aide: 'Le corps du journal.' },
  { id: 'affirmee', label: 'Affirmée', aide: 'L’ouverture d’un sujet.' },
  { id: 'marquee', label: 'Marquée', aide: 'Les alertes.' },
];

/**
 * Le choix de l'entrée : neuf vignettes qui jouent, groupées par intention.
 *
 * Elles remplacent une liste déroulante de neuf noms. Le groupement par
 * intention est celui de la maquette validée : un monteur sait s'il veut être
 * sobre ou marquant avant de savoir s'il veut un flou ou une saccade.
 */
export function ChoixEntree({ valeur, onChange, recommandee }) {
  const frame = useImageAnimee(CYCLE_VIGNETTE);

  return (
    <div className="flex flex-col gap-2.5">
      {FAMILLES.map((famille) => {
        const liste = TEXT_ANIMATIONS_IN.filter((a) => a.famille === famille.id);
        if (liste.length === 0) return null;
        return (
          <div key={famille.id} className="flex flex-col gap-1.5">
            <div className="flex items-baseline gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--muted)]">{famille.label}</span>
              <span className="text-[10px] text-[color:var(--muted)] opacity-70">{famille.aide}</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {liste.map((a) => {
                const actif = (valeur || 'fade') === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onChange(a.id)}
                    aria-pressed={actif}
                    className={`flex flex-col gap-1 p-1.5 rounded-lg border text-left motion-tap ${
                      actif
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                        : 'border-[var(--border)] bg-[var(--paper)] hover:border-[var(--accent)]/50'
                    }`}
                  >
                    <Scene>
                      <ApercuMouvement frame={frame} animation={a.id} mot="Texte" taille={13} />
                    </Scene>
                    <span className="text-[10px] font-semibold text-[color:var(--ink)] leading-tight truncate">
                      {a.label}
                      {recommandee === a.id && (
                        <span className="text-[color:var(--accent)] font-normal"> · conseillé</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
