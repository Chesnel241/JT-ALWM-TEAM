import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TexteJT, { FournitureHabillage } from '../../remotion/src/TexteJT.jsx';
import { MOUVEMENT, images } from '../../remotion/src/identite.js';

/**
 * Le texte d'un habillage, à une image donnée.
 *
 * `TexteJT` n'appelle aucun hook de Remotion : le fournisseur lit l'horloge
 * une fois et la transmet. Un test peut donc fournir l'image directement, sans
 * monter de composition ni de lecteur — et sans dépendre de l'interopérabilité
 * entre les deux builds de Remotion, qui fournit deux contextes React
 * distincts et fait échouer les hooks.
 */

const FPS = 30;

/** Un habillage minimal, figé à une image, pour isoler le texte. */
function poser({ frame, overlay = {}, duree = 90, delai = 0, enfant = 'Le marché de Douala' }) {
  return render(
    <FournitureHabillage overlay={overlay} durationInFrames={duree} frame={frame} fps={FPS}>
      <TexteJT role="titrage" delai={delai} data-testid="texte" style={{ fontSize: '50px' }}>
        {enfant}
      </TexteJT>
    </FournitureHabillage>
  );
}

const styleDe = (el) => el.getAttribute('style') || '';
/** L'opacité en nombre : `\b` faisait correspondre « 0 » dans « 0.488 ». */
const opaciteDe = (el) => Number(/opacity:\s*([\d.]+)/.exec(styleDe(el))?.[1]);

describe('le texte porte le mouvement choisi', () => {
  it('est invisible à la première image d’un fondu', () => {
    poser({ frame: 0, overlay: { animation: 'fade' } });
    expect(opaciteDe(screen.getByTestId('texte'))).toBe(0);
  });

  it('est posé une fois l’entrée terminée', () => {
    poser({ frame: images(MOUVEMENT.entree, FPS) + 2, overlay: { animation: 'fade' } });
    expect(opaciteDe(screen.getByTestId('texte'))).toBe(1);
  });

  it('glisse quand on choisit le glissé', () => {
    poser({ frame: 2, overlay: { animation: 'slide' } });
    expect(styleDe(screen.getByTestId('texte'))).toMatch(/translateX/);
  });

  it('applique le contour et le halo, inertes jusqu’ici', () => {
    // Deux réglages du studio que plus rien ne lisait depuis que le composant
    // qui les portait était sorti du registre.
    poser({ frame: 40, overlay: { animation: 'fade', outline: 3, glow: 4 } });
    const style = styleDe(screen.getByTestId('texte'));
    expect(style).toMatch(/text-stroke/);
    expect(style).toMatch(/text-shadow/);
  });

  it('attend son décalage avant de commencer', () => {
    // Un bandeau révèle ses lignes l'une après l'autre. Sans ce décalage, le
    // texte s'animerait derrière un masque encore fermé : le monteur choisit
    // « Machine à écrire » et découvre un texte déjà tapé.
    const avecRetard = poser({ frame: 3, delai: 10, overlay: { animation: 'fade' } });
    expect(opaciteDe(avecRetard.getByTestId('texte'))).toBe(0);
    avecRetard.unmount();

    poser({ frame: 3, delai: 0, overlay: { animation: 'fade' } });
    expect(opaciteDe(screen.getByTestId('texte'))).toBeGreaterThan(0);
  });

  it('conserve le style que le gabarit lui donne', () => {
    // Le composant rend le même élément, avec le style fusionné : c'est ce qui
    // garantit qu'aucune mise en page ne bouge.
    poser({ frame: 40, overlay: { animation: 'fade' } });
    expect(styleDe(screen.getByTestId('texte'))).toMatch(/font-size:\s*50px/);
  });
});

describe('la machine à écrire', () => {
  it('découpe le texte en lettres, sans en perdre une seule', () => {
    poser({ frame: 60, overlay: { animation: 'typewriter' } });
    const el = screen.getByTestId('texte');
    // Le gabarit n'a rien à faire : le découpage se produit dans le composant.
    expect(el.querySelectorAll('span').length).toBe('Le marché de Douala'.length);
    expect(el.textContent.replace(/\u00A0/g, ' ')).toBe('Le marché de Douala');
  });

  it('n’a pas encore écrit ses dernières lettres à la première image', () => {
    poser({ frame: 0, overlay: { animation: 'typewriter' } });
    const spans = [...screen.getByTestId('texte').querySelectorAll('span')];
    expect(opaciteDe(spans[0])).toBe(1);
    expect(opaciteDe(spans.at(-1))).toBe(0);
  });
});

describe('sans fournisseur', () => {
  it('affiche le texte au lieu de lever, et sans l’animer', () => {
    // Le bandeau défilant, le badge DIRECT et les sous-titres vivent hors du
    // répartiteur : un composant de feuille ne doit pas pouvoir abattre son
    // parent, ni rendre un texte invisible.
    expect(() => render(<TexteJT data-testid="orphelin">Bonsoir à tous</TexteJT>)).not.toThrow();
    const el = screen.getByTestId('orphelin');
    expect(el).toHaveTextContent('Bonsoir à tous');
    expect(styleDe(el)).not.toMatch(/opacity/);
  });
});
