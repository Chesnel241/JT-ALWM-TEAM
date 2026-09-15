import React, { createContext, useContext, useMemo } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { PAR_LETTRE, styleLettre, styleTexte } from './mouvement.js';
import { fxStyle } from './theme.js';

/**
 * Le texte d'un habillage, animé selon ce que le monteur a choisi.
 *
 * Il remplace le composant `Tx`, qui portait la même idée mais n'était utilisé
 * que par deux habillages absents du registre : les trois menus d'animation du
 * studio ne commandaient donc rien.
 *
 * Deux principes, et ils expliquent tout le reste :
 *
 * 1. **Il rend le même élément que le gabarit utilisait**, avec le style
 *    fusionné. Pas de nœud DOM supplémentaire, donc aucun risque de décaler
 *    une mise en page — plusieurs gabarits passent des marges négatives, des
 *    `zIndex` et des `flex` à travers leurs enveloppes.
 * 2. **Il n'anime que le texte**, jamais le bloc. Les conteneurs gardent
 *    l'arrivée qu'on leur a dessinée.
 *
 * L'horloge se lit à un seul endroit
 * ----------------------------------
 * `TexteJT` n'appelle aucun hook de Remotion : c'est le fournisseur qui lit
 * l'image et la cadence, et les transmet. Une seule lecture pour tout un
 * habillage, et surtout un composant qui se teste sans monter de composition.
 */

const ContexteHabillage = createContext(null);

/**
 * Le contexte tel qu'il est consommé, sans dépendance à Remotion.
 *
 * Séparé du fournisseur qui lit l'horloge, pour qu'un appelant connaissant
 * déjà l'image — un test, un aperçu — puisse s'en servir directement.
 */
export function FournitureHabillage({ overlay, durationInFrames, frame, fps, children }) {
  const valeur = useMemo(
    () => ({ overlay: overlay || {}, durationInFrames, frame, fps, anime: true }),
    [overlay, durationInFrames, frame, fps]
  );
  return <ContexteHabillage.Provider value={valeur}>{children}</ContexteHabillage.Provider>;
}

/**
 * Ce que le répartiteur `Overlay` sait déjà, mis à disposition du texte.
 *
 * Sans lui, les 23 gabarits devraient enfiler quatre propriétés à travers
 * leurs éléments imbriqués pour qu'une ligne de texte connaisse la durée de
 * son habillage et l'image courante.
 */
export function FournisseurHabillage({ overlay, durationInFrames, children }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <FournitureHabillage overlay={overlay} durationInFrames={durationInFrames} frame={frame} fps={fps}>
      {children}
    </FournitureHabillage>
  );
}

/**
 * Le contexte est facultatif.
 *
 * Le bandeau défilant, le badge DIRECT et les sous-titres vivent hors du
 * répartiteur. Sans ce repli, un `<TexteJT>` y lèverait au lieu d'afficher son
 * texte — et un texte immobile vaut mieux qu'un texte absent. Même convention
 * que `useOptionalToast` côté studio : un composant de feuille ne doit pas
 * pouvoir abattre son parent.
 */
const SANS_HABILLAGE = { overlay: {}, durationInFrames: undefined, frame: 0, fps: 30, anime: false };

/** Découpe un texte en lettres, en gardant les espaces à l'œil. */
function lettres(contenu) {
  return [...String(contenu)].map((c) => (c === ' ' ? ' ' : c));
}

export default function TexteJT({
  children,
  as: Element = 'div',
  style = {},
  delai = 0,
  // Le rôle typographique est transmis dès maintenant pour ne pas repasser une
  // seconde fois sur les 23 gabarits. Il ne modifie encore ni la taille ni la
  // police : cela changerait les mises en page, ce qui demande un avant/après.
  role = 'courant',
  ...reste
}) {
  const { overlay, durationInFrames, frame, fps, anime } = useContext(ContexteHabillage) || SANS_HABILLAGE;

  const effets = fxStyle(Number(overlay.outline) || 0, Number(overlay.glow) || 0);

  if (!anime) {
    return <Element {...reste} data-role={role} style={{ ...style, ...effets }}>{children}</Element>;
  }

  const animation = overlay.animation || 'fade';
  const commun = { frame, fps, delai, animation };

  // Les révélations lettre par lettre se découpent ici : le gabarit ne s'en
  // occupe pas, et n'a pas à savoir qu'un mouvement est de cette nature.
  if (PAR_LETTRE.has(animation)) {
    const caracteres = lettres(children);
    return (
      <Element {...reste} data-role={role} style={{ ...style, ...effets }}>
        {caracteres.map((c, i) => (
          <span
            // Le texte est figé pour une image donnée : l'index est une clé
            // stable, et deux lettres identiques doivent rester distinctes.
            key={`${i}-${c}`}
            style={{
              display: 'inline-block',
              whiteSpace: 'pre',
              ...styleLettre({ ...commun, index: i, total: caracteres.length }),
            }}
          >
            {c}
          </span>
        ))}
      </Element>
    );
  }

  const mouvement = styleTexte({
    ...commun,
    durationInFrames,
    boucle: overlay.animationLoop || 'none',
    sortie: overlay.animationOut || 'auto',
  });

  // La transformation se compose au lieu d'écraser : quelques éléments de
  // texte portent déjà un `skewX` qui contre celui de leur parent.
  const transform = [style.transform, mouvement.transform].filter(Boolean).join(' ') || undefined;
  const filter = [style.filter, mouvement.filter].filter(Boolean).join(' ') || undefined;

  return (
    <Element
      {...reste}
      data-role={role}
      style={{ ...style, ...effets, ...mouvement, transform, filter }}
    >
      {children}
    </Element>
  );
}
