import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ApercuMouvement, ChoixEntree } from '../src/components/editor/ChoixMouvement.jsx';
import { TEXT_ANIMATIONS_IN } from '../src/data/overlayTemplates.js';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';
import { translations } from '../src/i18n/translations.js';
import { MOUVEMENT, images } from '../../remotion/src/identite.js';

/**
 * Choisir un mouvement en le voyant.
 *
 * « Flou », « Saccade », « Rapproché » ne veulent rien dire tant qu'on ne les
 * a pas vus : le monteur choisissait dans une liste, générait le master, et
 * recommençait — trois minutes de rendu par essai.
 *
 * Ce que ces tests protègent avant tout, c'est que l'aperçu **monte le
 * composant du rendu**, et non une seconde implémentation « pour l'écran ».
 * C'est une divergence de ce genre qui avait laissé les trois menus
 * d'animation ne commander rien pendant des mois.
 */

const FPS = 30;
const dit = translations.fr.studio;
const poserChoix = (props) => render(<I18nProvider><ChoixEntree {...props} /></I18nProvider>);
const styleDe = (el) => el.getAttribute('style') || '';
const opaciteDe = (el) => Number(/opacity:\s*([\d.]+)/.exec(styleDe(el))?.[1]);

beforeEach(() => {
  // jsdom annonce `navigator.language = 'en-US'` : sans ce choix explicite,
  // le fournisseur monterait l'interface en anglais et les libellés attendus
  // ne correspondraient pas. Même convention que Nav.test.jsx.
  localStorage.clear();
  localStorage.setItem('jt-alwm-lang', 'fr');

  // jsdom n'implémente pas matchMedia : sans ce doublet, l'horloge croit que
  // le mouvement réduit est demandé et fige tous les aperçus.
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addListener: vi.fn(), removeListener: vi.fn() });
  }
});

describe('l’aperçu joue le mouvement, pas une imitation', () => {
  it('est invisible à la première image, et posé une fois l’entrée finie', () => {
    const { container, rerender } = render(<ApercuMouvement frame={0} animation="fade" mot="Douala" />);
    const texte = () => container.querySelector('[data-role]');
    expect(opaciteDe(texte())).toBe(0);

    rerender(<ApercuMouvement frame={images(MOUVEMENT.entree, FPS) + 2} animation="fade" mot="Douala" />);
    expect(opaciteDe(texte())).toBe(1);
  });

  it('découpe le texte en lettres pour la machine à écrire', () => {
    // Le découpage se produit dans `TexteJT`, pas dans l'aperçu : si celui-ci
    // réimplémentait le mouvement, il n'y aurait aucun <span>.
    const { container } = render(<ApercuMouvement frame={10} animation="typewriter" mot="Douala" />);
    expect(container.querySelectorAll('span').length).toBe('Douala'.length);
  });

  it('joue la sortie quand la durée de l’aperçu est bornée', () => {
    // C'est ce qui distingue le grand aperçu des vignettes : lui montre la
    // combinaison entière, elles ne montrent que l'entrée.
    const { container } = render(
      <ApercuMouvement frame={89} animation="fade" sortie="fade" duree={90} mot="Douala" />
    );
    expect(opaciteDe(container.querySelector('[data-role]'))).toBeLessThan(0.2);
  });

  it('ne s’efface jamais quand la durée n’est pas bornée', () => {
    const { container } = render(<ApercuMouvement frame={4000} animation="fade" mot="Douala" />);
    expect(opaciteDe(container.querySelector('[data-role]'))).toBe(1);
  });
});

describe('le choix de l’entrée', () => {
  it('propose les neuf mouvements, groupés par intention', () => {
    poserChoix({ valeur: 'fade', onChange: vi.fn() });
    TEXT_ANIMATIONS_IN.forEach((a) => {
      expect(screen.getByText(new RegExp(`^${dit.entrees[a.id]}`)), a.id).toBeInTheDocument();
    });
    Object.values(dit.familles).forEach((f) => expect(screen.getByText(f.label)).toBeInTheDocument());
  });

  it('marque le mouvement courant, et un seul', () => {
    poserChoix({ valeur: 'glitch_in', onChange: vi.fn() });
    const presses = screen.getAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(presses.length).toBe(1);
    expect(presses[0]).toHaveTextContent(dit.entrees.glitch_in);
  });

  it('signale celui que le gabarit conseille', () => {
    poserChoix({ valeur: 'fade', onChange: vi.fn(), recommandee: 'slide' });
    expect(screen.getByText(new RegExp(dit.interface.conseille))).toBeInTheDocument();
  });

  it('remonte l’identifiant du mouvement, pas son libellé', () => {
    const onChange = vi.fn();
    poserChoix({ valeur: 'fade', onChange });
    fireEvent.click(screen.getByText(new RegExp(`^${dit.entrees.typewriter}`)));
    expect(onChange).toHaveBeenCalledWith('typewriter');
  });
});

describe('un monteur anglophone lit son studio', () => {
  it('voit les mouvements dans sa langue', () => {
    // Le studio était intégralement en français codé en dur : un monteur au
    // Ghana ou au Nigeria disposait d'une station entièrement française.
    localStorage.setItem('jt-alwm-lang', 'en');
    poserChoix({ valeur: 'fade', onChange: vi.fn() });
    expect(screen.getByText(/^Typewriter/)).toBeInTheDocument();
    expect(screen.getByText(translations.en.studio.familles.marquee.label)).toBeInTheDocument();
    expect(screen.queryByText(/^Machine à écrire/)).not.toBeInTheDocument();
  });
});
