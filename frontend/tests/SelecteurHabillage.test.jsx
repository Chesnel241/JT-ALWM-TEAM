import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { SelecteurHabillage } from '../src/components/editor/OverlayPanel.jsx';
import { CLIP_TEMPLATES, MOMENTS, habillagesDuMoment } from '../src/data/overlayTemplates.js';

/**
 * Trouver la bonne option : la première des trois douleurs remontées.
 *
 * Les vingt-trois habillages s'affichaient en une seule liste, rangée par
 * portée technique — « clip » ou « global ». C'est un détail d'implémentation
 * que le monteur n'a aucune raison de connaître, et il fallait parcourir les
 * vingt-trois pour retrouver le bandeau nom.
 */

const poser = (props = {}) =>
  render(
    <SelecteurHabillage
      modeles={CLIP_TEMPLATES}
      onChoisir={vi.fn()}
      onAnnuler={vi.fn()}
      {...props}
    />
  );

// `queryAll` et non `getAll` : quand la recherche ne trouve rien, l'absence
// de titre est le résultat attendu, pas une erreur du test.
const titresDeMoment = () =>
  screen.queryAllByRole('heading', { level: 3 }).map((h) => h.textContent);

describe('le sélecteur range par moment du JT', () => {
  it('n’affiche que les moments qui ont des habillages pour ce contexte', () => {
    poser();
    const attendus = MOMENTS
      .filter((m) => habillagesDuMoment(m.id, CLIP_TEMPLATES).length > 0)
      .map((m) => m.label);
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
    expect(screen.getByText('Citation')).toBeInTheDocument();
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
    fireEvent.click(within(groupe).getByText('Citation'));
    expect(onChoisir).toHaveBeenCalledWith('envato_quote');
  });
});
