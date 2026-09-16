import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { SelecteurHabillage } from '../src/components/editor/OverlayPanel.jsx';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';
import { translations } from '../src/i18n/translations.js';
import { CLIP_TEMPLATES, MOMENTS_IDS, habillagesDuMoment } from '../src/data/overlayTemplates.js';

/**
 * Trouver la bonne option : la première des trois douleurs remontées.
 *
 * Les vingt-trois habillages s'affichaient en une seule liste, rangée par
 * portée technique — « clip » ou « global ». C'est un détail d'implémentation
 * que le monteur n'a aucune raison de connaître, et il fallait parcourir les
 * vingt-trois pour retrouver le bandeau nom.
 */

const dit = translations.fr.studio;

beforeEach(() => {
  // jsdom annonce `navigator.language = 'en-US'` : sans ce choix explicite, le
  // sélecteur monterait en anglais. Même convention que Nav.test.jsx.
  localStorage.clear();
  localStorage.setItem('jt-alwm-lang', 'fr');
});

const poser = (props = {}) =>
  render(
    <I18nProvider>
      <SelecteurHabillage
        modeles={CLIP_TEMPLATES}
        onChoisir={vi.fn()}
        onAnnuler={vi.fn()}
        {...props}
      />
    </I18nProvider>
  );

// `queryAll` et non `getAll` : quand la recherche ne trouve rien, l'absence
// de titre est le résultat attendu, pas une erreur du test.
const titresDeMoment = () =>
  screen.queryAllByRole('heading', { level: 3 }).map((h) => h.textContent);

describe('le sélecteur range par moment du JT', () => {
  it('n’affiche que les moments qui ont des habillages pour ce contexte', () => {
    poser();
    const attendus = MOMENTS_IDS
      .filter((id) => habillagesDuMoment(id, CLIP_TEMPLATES).length > 0)
      .map((id) => dit.moments[id].label);
    expect(titresDeMoment()).toEqual(attendus);
  });

  it('respecte l’ordre d’antenne, et non l’ordre alphabétique', () => {
    // Un monteur pense « j'ouvre, je titre, j'identifie » — pas « alerte,
    // clôture, identification ».
    poser();
    const titres = titresDeMoment();
    expect(titres[0]).toBe('Ouverture');
    expect(titres.indexOf('Titrage')).toBeLessThan(titres.indexOf('Identification'));
  });

  it('montre tous les habillages du contexte', () => {
    poser();
    expect(screen.getAllByRole('button').length - 1).toBe(CLIP_TEMPLATES.length); // -1 : « Annuler »
  });
});

describe('la recherche', () => {
  it('filtre sur le nom de l’habillage', () => {
    poser();
    fireEvent.change(screen.getByLabelText('Chercher un habillage'), { target: { value: 'citation' } });
    expect(titresDeMoment()).toEqual(['Identification']);
    expect(screen.getByText(dit.habillages.envato_quote.label)).toBeInTheDocument();
  });

  it('filtre aussi sur ce que l’habillage fait, pas seulement sur son nom', () => {
    // Un monteur cherche « qui parle », pas « nom_interview ». La description
    // et l'intitulé du moment comptent autant que le libellé.
    poser();
    fireEvent.change(screen.getByLabelText('Chercher un habillage'), { target: { value: 'qui parle' } });
    expect(titresDeMoment()).toEqual(['Identification']);
  });

  it('le dit quand rien ne correspond, au lieu de ne rien montrer', () => {
    poser();
    fireEvent.change(screen.getByLabelText('Chercher un habillage'), { target: { value: 'zzzz' } });
    expect(titresDeMoment()).toEqual([]);
    expect(screen.getByText(/Aucun habillage ne correspond/)).toBeInTheDocument();
  });
});

describe('le choix', () => {
  it('remonte l’identifiant de l’habillage, pas son libellé', () => {
    const onChoisir = vi.fn();
    poser({ onChoisir });
    const groupe = screen.getByRole('heading', { name: 'Identification' }).closest('div').parentElement;
    fireEvent.click(within(groupe).getByText(dit.habillages.envato_quote.label));
    expect(onChoisir).toHaveBeenCalledWith('envato_quote');
  });
});

describe('un monteur anglophone lit son catalogue', () => {
  it('voit les moments et les habillages dans sa langue', () => {
    localStorage.setItem('jt-alwm-lang', 'en');
    poser();
    expect(titresDeMoment()).toContain(translations.en.studio.moments.identification.label);
    expect(screen.getByText(translations.en.studio.habillages.envato_quote.label)).toBeInTheDocument();
    expect(screen.queryByText(dit.habillages.envato_quote.label)).not.toBeInTheDocument();
  });
});
