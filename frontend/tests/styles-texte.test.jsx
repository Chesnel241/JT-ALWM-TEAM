import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OverlayEditor } from '../src/components/editor/OverlayPanel.jsx';
import { I18nProvider } from '../src/i18n/I18nContext.jsx';
import {
  STYLES, OVERLAY_TEMPLATES, changerDeStyle, familleDe, stylesDe, sansDoublonsDeStyle,
} from '../src/data/overlayTemplates.js';

beforeEach(() => { localStorage.clear(); localStorage.setItem('jt-alwm-lang', 'fr'); });

// LE CONSTAT : le catalogue alignait six « titres de reportage », quatre
// « noms », trois « alertes ». Essayer un autre dessin obligeait à supprimer
// le texte et à tout retaper. Et pour un simple nom, quarante réglages à plat.
describe('les styles d’un même texte', () => {
  it('chaque style déclaré existe au catalogue', () => {
    const ids = new Set(OVERLAY_TEMPLATES.map((t) => t.id));
    for (const membres of Object.values(STYLES)) for (const id of membres) expect(ids.has(id)).toBe(true);
  });

  it('changer de style garde ce qui a été écrit', () => {
    const nom = { templateId: 'nom_interview', fields: { nom: 'Aminata Diallo', fonction: 'Ministre' }, startTime: 2 };
    const presentateur = changerDeStyle(nom, 'envato_presenter');
    expect(presentateur.templateId).toBe('envato_presenter');
    expect(presentateur.fields).toMatchObject({ name: 'Aminata Diallo', title: 'Ministre' });
    expect(presentateur.startTime).toBe(2);
  });

  it('revenir au style précédent rend aussi ce qu’il était seul à afficher', () => {
    const depart = { templateId: 'nom_interview', fields: { nom: 'Aminata Diallo', fonction: 'Ministre' } };
    const retour = changerDeStyle(changerDeStyle(depart, 'envato_lt_compact'), 'nom_interview');
    expect(retour.fields).toMatchObject({ nom: 'Aminata Diallo', fonction: 'Ministre' });
  });

  it('une alerte en bandeau devient une alerte plein écran sans perdre son texte', () => {
    const flash = { templateId: 'flash_info', fields: { titre: 'FLASH', texte: 'Le Sénat vote le budget' } };
    expect(changerDeStyle(flash, 'breaking_news').fields).toMatchObject({ titre: 'FLASH', texte: 'Le Sénat vote le budget' });
  });

  it('un texte de plan ne devient pas un habillage de tout le JT', () => {
    expect(stylesDe('envato_news')).toEqual(['envato_news']);
    expect(stylesDe('flash_info')).toEqual(['flash_info', 'breaking_news']);
    expect(stylesDe('titre_reportage')).toHaveLength(6);
    expect(stylesDe('envato_quote')).toEqual([]);
  });

  it('le catalogue ne garde qu’un représentant par famille', () => {
    const restants = sansDoublonsDeStyle(OVERLAY_TEMPLATES.filter((t) => t.scope !== 'global')).map((t) => t.id);
    expect(restants.filter((id) => familleDe(id) === 'titre')).toEqual(['titre_reportage']);
    // Le plus simple d'abord : « Nom et fonction », pas le bandeau du présentateur.
    expect(restants.filter((id) => familleDe(id) === 'nom')).toEqual(['nom_interview']);
    expect(restants).toContain('envato_quote');
  });
});

describe('l’éditeur d’un texte', () => {
  const poser = (overlay) => {
    const onChange = vi.fn();
    render(<I18nProvider><OverlayEditor overlay={overlay} onChange={onChange} onRemove={() => {}} /></I18nProvider>);
    return onChange;
  };
  const nom = { id: 'a', templateId: 'nom_interview', fields: { nom: 'Aminata Diallo', fonction: 'Ministre' }, startTime: 0, duration: null };

  it('se présente par ce qu’on écrit, et propose ses styles', () => {
    const onChange = poser(nom);
    expect(screen.getByText('Nom d’une personne')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Présentateur' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      templateId: 'envato_presenter',
      fields: expect.objectContaining({ name: 'Aminata Diallo' }),
    }));
  });

  it('« quand l’afficher » se règle en un clic, sans compter les secondes', () => {
    const onChange = poser(nom);
    expect(screen.getByRole('button', { name: 'Tout du long' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Au début (5 s)' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ startTime: 0, duration: 5 }));
  });

  it('les secondes n’apparaissent que si on les demande', () => {
    poser(nom);
    expect(screen.queryByLabelText('Début (s)')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Choisir…' }));
    expect(screen.getByLabelText('Début (s)')).toBeInTheDocument();
  });

  it('un texte déjà réglé à la seconde montre ses secondes d’emblée', () => {
    poser({ ...nom, startTime: 3, duration: 8 });
    expect(screen.getByLabelText('Début (s)')).toHaveValue(3);
  });

  it('mouvement, police, couleurs et position sont repliés', () => {
    poser(nom);
    const replis = document.querySelector('details');
    expect(replis).not.toBeNull();
    expect(replis.open).toBe(false);
    expect(replis.querySelector('select')).not.toBeNull(); // la police y est rangée
    expect(screen.getByText('Réglages avancés')).toBeInTheDocument();
  });

  it('un texte sans autre style n’affiche pas de choix de style', () => {
    poser({ id: 'c', templateId: 'envato_quote', fields: {}, startTime: 0, duration: null });
    expect(screen.queryByRole('group', { name: 'Style' })).toBeNull();
  });
});

// LE BESOIN : déplacer un bandeau demandait deux curseurs « Position X » et
// « Position Y » en pixels ; et l'on choisissait un habillage sur une icône.
describe('poser et choisir sur image', () => {
  const poser = (overlay) => {
    const onChange = vi.fn();
    render(<I18nProvider><OverlayEditor overlay={overlay} onChange={onChange} onRemove={() => {}} /></I18nProvider>);
    return onChange;
  };
  const nom = { id: 'a', templateId: 'nom_interview', fields: { nom: 'Aminata Diallo' }, startTime: 0, duration: null, posX: 40, posY: -12 };

  it('un coin se choisit d’un clic, et remet le décalage à zéro', () => {
    const onChange = poser(nom);
    expect(screen.getByRole('button', { name: 'En bas à gauche' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'En haut à droite' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ place: 'haut-droite', posX: 0, posY: 0 }));
  });

  it('le lieu part d’en haut à gauche', () => {
    poser({ id: 'l', templateId: 'envato_loc_pin', fields: { location: 'Douala' }, startTime: 0, duration: null });
    expect(screen.getByRole('button', { name: 'En haut à gauche' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('un écran plein ne propose pas de coin', () => {
    poser({ id: 'r', templateId: 'rappel_titres', fields: { titre1: 'Budget' }, startTime: 0, duration: null });
    expect(screen.queryByRole('group', { name: 'Où le poser' })).toBeNull();
  });

  it('chaque style montre son image réelle', () => {
    poser(nom);
    const images = [...document.querySelectorAll('img')].map((i) => i.getAttribute('src'));
    expect(images).toContain('/habillages/nom_interview.jpg');
    expect(images).toContain('/habillages/envato_presenter.jpg');
  });

  it('chaque habillage du catalogue a son image', async () => {
    const { existsSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    for (const modele of OVERLAY_TEMPLATES) {
      expect(existsSync(resolve(__dirname, `../public/habillages/${modele.id}.jpg`)), modele.id).toBe(true);
    }
  });
});
