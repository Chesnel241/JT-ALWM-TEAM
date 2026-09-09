import { describe, it, expect } from 'vitest';
import {
  WORKSPACES,
  parsePath,
  buildPath,
  isViewAllowed,
  viewsForWorkspace,
  defaultViewFor,
} from '../src/lib/routing.js';

describe('routing — lecture de l\'URL', () => {
  it('envoie la racine sur l\'espace montage (favoris historiques)', () => {
    expect(parsePath('/')).toEqual({ workspace: WORKSPACES.EDITOR, view: 'home' });
  });

  it('ouvre l\'accueil journalistes sur /journalistes', () => {
    expect(parsePath('/journalistes')).toEqual({ workspace: WORKSPACES.REPORTER, view: 'hub' });
  });

  it('accepte les alias de lien recopiés à la main', () => {
    for (const path of ['/journaliste', '/reporters', '/reportages', '/JOURNALISTES/']) {
      expect(parsePath(path).workspace).toBe(WORKSPACES.REPORTER);
    }
    for (const path of ['/monteurs', '/monteur', '/montage']) {
      expect(parsePath(path).workspace).toBe(WORKSPACES.EDITOR);
    }
  });

  it('résout les vues des deux espaces', () => {
    expect(parsePath('/journalistes/reportage').view).toBe('home');
    expect(parsePath('/journalistes/telecharger-le-jt').view).toBe('delivery');
    expect(parsePath('/monteurs/montage').view).toBe('dashboard');
    expect(parsePath('/monteurs/voix-off').view).toBe('voixoff');
  });

  it('retombe sur l\'accueil de l\'espace pour une URL inconnue', () => {
    expect(parsePath('/journalistes/nimporte-quoi').view).toBe('hub');
    expect(parsePath('/nimporte-quoi').view).toBe('home');
  });

  it('ne laisse pas une URL journaliste ouvrir une vue montage', () => {
    expect(parsePath('/journalistes/montage').view).toBe('hub');
    expect(parsePath('/journalistes/stats').view).toBe('hub');
  });
});

describe('routing — écriture de l\'URL', () => {
  it('construit des URLs canoniques par espace', () => {
    expect(buildPath(WORKSPACES.EDITOR, 'home')).toBe('/monteurs');
    expect(buildPath(WORKSPACES.EDITOR, 'dashboard')).toBe('/monteurs/montage');
    expect(buildPath(WORKSPACES.REPORTER, 'hub')).toBe('/journalistes');
    expect(buildPath(WORKSPACES.REPORTER, 'home')).toBe('/journalistes/reportage');
    expect(buildPath(WORKSPACES.REPORTER, 'delivery')).toBe('/journalistes/telecharger-le-jt');
  });

  it('rabat une vue interdite sur l\'accueil de l\'espace', () => {
    expect(buildPath(WORKSPACES.REPORTER, 'dashboard')).toBe('/journalistes');
    expect(buildPath(WORKSPACES.REPORTER, 'stats')).toBe('/journalistes');
  });

  it('aller-retour URL → vue → URL stable', () => {
    for (const path of ['/monteurs', '/monteurs/jt-pret', '/journalistes', '/journalistes/reportage']) {
      const { workspace, view } = parsePath(path);
      expect(buildPath(workspace, view)).toBe(path);
    }
  });
});

describe('routing — périmètre des espaces', () => {
  it('limite les journalistes au reportage et au JT prêt', () => {
    expect(viewsForWorkspace(WORKSPACES.REPORTER)).toEqual(['hub', 'home', 'uploader', 'delivery']);
    for (const view of ['dashboard', 'voixoff', 'stats', 'editor']) {
      expect(isViewAllowed(WORKSPACES.REPORTER, view)).toBe(false);
    }
  });

  it('laisse l\'équipe montage sur tous les onglets', () => {
    for (const view of ['home', 'uploader', 'dashboard', 'voixoff', 'delivery', 'stats', 'editor']) {
      expect(isViewAllowed(WORKSPACES.EDITOR, view)).toBe(true);
    }
  });

  it('expose une vue d\'accueil par espace', () => {
    expect(defaultViewFor(WORKSPACES.REPORTER)).toBe('hub');
    expect(defaultViewFor(WORKSPACES.EDITOR)).toBe('home');
  });
});

describe('indicatif téléphonique par défaut', () => {
  it("part du pays choisi plutôt que de la France", async () => {
    const { phoneCountryFor } = await import('../src/lib/phone.js');
    expect(phoneCountryFor('cm')).toBe('CM');
    expect(phoneCountryFor('sn')).toBe('SN');
    expect(phoneCountryFor('CI')).toBe('CI');
  });

  it("retombe sur la France pour les entrées qui ne sont pas des pays", async () => {
    const { phoneCountryFor } = await import('../src/lib/phone.js');
    expect(phoneCountryFor('tj')).toBe('FR');
    expect(phoneCountryFor('mj')).toBe('FR');
    expect(phoneCountryFor('')).toBe('FR');
    expect(phoneCountryFor(undefined)).toBe('FR');
  });
});
