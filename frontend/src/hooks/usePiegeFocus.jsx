import { useCallback, useEffect, useRef } from 'react';

/**
 * Ce qu'une boîte modale doit au clavier.
 *
 * L'incident
 * ----------
 * Neuf composants du studio déclarent `role="dialog" aria-modal="true"`.
 * **Deux seulement** tenaient leur promesse : `ConfirmDialog` et
 * `AdminUploadDialog`. Les sept autres — le panneau d'habillage, celui des
 * sous-titres, le rognage précis, l'habillage global, l'ajout de pays, le
 * retour d'expérience, le tutoriel — annonçaient une boîte modale à un lecteur
 * d'écran sans en être une : la tabulation repartait derrière le voile, sur
 * les boutons de la page qu'on croyait avoir quittée, et Échap ne fermait
 * rien.
 *
 * Et les deux qui l'avaient portaient **deux copies quasi identiques** de la
 * même quarantaine de lignes. Deux copies divergent toujours ; celle du lot 5
 * — la règle de durée recopiée trois fois dans `JTMaster` — avait laissé un
 * défaut partir à l'antenne pendant des mois.
 *
 * Ce que ce hook ajoute aux deux qui l'avaient déjà
 * ------------------------------------------------
 * **Le retour du focus.** Ni l'un ni l'autre ne rendait le focus au bouton qui
 * avait ouvert le panneau : le fermer renvoyait au début du document, et il
 * fallait retraverser tout le studio à la tabulation pour revenir où on en
 * était. C'est la moitié du geste qui manquait.
 *
 * Usage
 * -----
 *   const boite = usePiegeFocus(ouvert, fermer);
 *   return ouvert ? <div ref={boite} role="dialog" aria-modal="true">…</div> : null;
 *
 * Le hook s'appelle toujours, même fermé — c'est la règle des hooks React ; il
 * ne fait simplement rien tant que `ouvert` est faux.
 */

/**
 * Ce qui peut recevoir le focus, dans l'ordre du document.
 *
 * `[disabled]` est écarté : `ConfirmDialog` désactive ses deux boutons pendant
 * un chargement, et l'ancienne version appelait alors `.focus()` sur un
 * `undefined`. Un panneau qui lève pendant qu'il travaille est pire que pas de
 * piège du tout.
 */
const FOCALISABLES = [
  'a[href]',
  'button',
  'input',
  'select',
  'textarea',
  '[tabindex]',
].map((s) => `${s}:not([disabled]):not([tabindex="-1"])`).join(', ');

export function elementsFocalisables(racine) {
  if (!racine) return [];
  return Array.from(racine.querySelectorAll(FOCALISABLES)).filter(
    // Le sélecteur ne voit que l'élément lui-même. Or un bouton **à
    // l'intérieur** d'un conteneur `aria-hidden` reste atteignable au clavier
    // tout en étant invisible pour un lecteur d'écran : le focus se pose sur
    // quelque chose qui, pour l'utilisateur, n'existe pas. C'est le piège
    // classique, et il faut remonter la parenté pour le fermer.
    (el) => !el.closest('[aria-hidden="true"], [hidden], [inert]'),
  );
}

/**
 * Où poser le focus en ouvrant.
 *
 * Le premier champ de saisie s'il y en a un — c'est ce que le monteur vient
 * faire —, sinon le premier élément focalisable. C'est le comportement que les
 * deux panneaux d'origine avaient, conservé tel quel.
 */
export function premierFocus(racine) {
  const focalisables = elementsFocalisables(racine);
  return focalisables.find((el) => el.matches('input, textarea')) || focalisables[0] || null;
}

export function usePiegeFocus(ouvert, surFermeture, { focusAuto = true } = {}) {
  const boite = useRef(null);
  const appelant = useRef(null);
  // La fermeture est lue au moment de la touche, jamais capturée : sans cela,
  // une fonction recréée à chaque rendu — le cas courant dans le studio —
  // ferait se réabonner le hook en boucle.
  const fermer = useRef(surFermeture);
  fermer.current = surFermeture;

  const surTouche = useCallback((evenement) => {
    if (evenement.key === 'Escape') {
      evenement.preventDefault();
      fermer.current?.();
      return;
    }
    if (evenement.key !== 'Tab') return;

    const focalisables = elementsFocalisables(boite.current);
    if (focalisables.length === 0) {
      // Rien à focaliser : on retient quand même la tabulation, sinon elle
      // repart derrière le voile — c'est exactement l'incident.
      evenement.preventDefault();
      return;
    }
    const premier = focalisables[0];
    const dernier = focalisables[focalisables.length - 1];
    const actif = document.activeElement;

    // Le focus peut être hors de la boîte — après un clic sur le voile, ou au
    // premier Tab quand l'ouverture n'a rien pu focaliser. On le ramène.
    if (!boite.current?.contains(actif)) {
      evenement.preventDefault();
      (evenement.shiftKey ? dernier : premier).focus();
      return;
    }
    if (evenement.shiftKey && actif === premier) {
      evenement.preventDefault();
      dernier.focus();
    } else if (!evenement.shiftKey && actif === dernier) {
      evenement.preventDefault();
      premier.focus();
    }
  }, []);

  useEffect(() => {
    if (!ouvert) return undefined;

    // Retenu avant de déplacer le focus, sinon on mémorise la boîte elle-même.
    appelant.current = document.activeElement;
    document.addEventListener('keydown', surTouche);
    if (focusAuto) premierFocus(boite.current)?.focus();

    return () => {
      document.removeEventListener('keydown', surTouche);
      const retour = appelant.current;
      appelant.current = null;
      // Seulement s'il est encore là : un bouton démonté avec le panneau —
      // « Supprimer », par exemple — ne peut plus rien recevoir, et forcer le
      // focus sur un nœud détaché le renverrait au <body>.
      if (retour && typeof retour.focus === 'function' && document.contains(retour)) {
        retour.focus();
      }
    };
  }, [ouvert, focusAuto, surTouche]);

  return boite;
}

export default usePiegeFocus;
