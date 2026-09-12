import { describe, it, expect } from 'vitest';
import {
  WORKSPACES,
  parsePath,
  buildPath,
  isViewAllowed,
  viewsForWorkspace,
  defaultViewFor,
  isCountrySegment,
} from '../src/lib/routing.js';

describe('routing — lecture de l\'URL', () => {
  it('envoie la racine sur le studio de montage (favoris historiques)', () => {
    expect(parsePath('/')).toEqual({ workspace: WORKSPACES.EDITOR, view: 'dashboard', countryId: '' });
  });

  it('ouvre l\'équipe montage sur son studio, pas sur la liste des pays', () => {
    expect(parsePath('/monteurs').view).toBe('dashboard');
    expect(parsePath('/monteurs/reportages').view).toBe('home');
  });

  it('accepte encore l\'ancien lien vers le studio', () => {
    expect(parsePath('/monteurs/montage').view).toBe('dashboard');
  });

  it('ouvre l\'accueil journalistes sur /journalistes', () => {
    expect(parsePath('/journalistes')).toEqual({ workspace: WORKSPACES.REPORTER, view: 'hub', countryId: '' });
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
    expect(parsePath('/monteurs/voix-off').view).toBe('voixoff');
  });

  it('retombe sur l\'accueil de l\'espace pour une URL inconnue', () => {
    expect(parsePath('/journalistes/nimporte-quoi').view).toBe('hub');
    expect(parsePath('/nimporte-quoi').view).toBe('dashboard');
  });

  it('ne laisse pas une URL journaliste ouvrir une vue montage', () => {
    expect(parsePath('/journalistes/montage').view).toBe('hub');
    expect(parsePath('/journalistes/stats').view).toBe('hub');
  });
});

describe('routing — écriture de l\'URL', () => {
  it('construit des URLs canoniques par espace', () => {
    expect(buildPath(WORKSPACES.EDITOR, 'dashboard')).toBe('/monteurs');
    expect(buildPath(WORKSPACES.EDITOR, 'home')).toBe('/monteurs/reportages');
    expect(buildPath(WORKSPACES.REPORTER, 'hub')).toBe('/journalistes');
    expect(buildPath(WORKSPACES.REPORTER, 'home')).toBe('/journalistes/reportage');
    expect(buildPath(WORKSPACES.REPORTER, 'delivery')).toBe('/journalistes/telecharger-le-jt');
  });

  it('rabat une vue interdite sur l\'accueil de l\'espace', () => {
    expect(buildPath(WORKSPACES.REPORTER, 'dashboard')).toBe('/journalistes');
    expect(buildPath(WORKSPACES.REPORTER, 'stats')).toBe('/journalistes');
  });

  it('aller-retour URL → vue → URL stable', () => {
    for (const path of ['/monteurs', '/monteurs/reportages', '/monteurs/jt-pret', '/journalistes', '/journalistes/reportage']) {
      const { workspace, view } = parsePath(path);
      expect(buildPath(workspace, view)).toBe(path);
    }
  });
});

describe('routing — périmètre des espaces', () => {
  it('inclut reportage, voixoff, les deux rubriques et le JT prêt', () => {
    // Le conducteur et le Mot du JT ont leur propre adresse : ce ne sont pas
    // des pays, donc pas un segment de pays.
    expect(viewsForWorkspace(WORKSPACES.REPORTER))
      .toEqual(['hub', 'home', 'uploader', 'voixoff', 'conducteur', 'motDuJt', 'delivery']);
    expect(isViewAllowed(WORKSPACES.REPORTER, 'voixoff')).toBe(true);
    for (const view of ['dashboard', 'stats', 'editor', 'planning']) {
      expect(isViewAllowed(WORKSPACES.REPORTER, view)).toBe(false);
    }
  });

  it('ne lit jamais « conducteur » ni « mot-du-jt » comme un pays', () => {
    // Sans cela, /journalistes/conducteur ouvrirait l'écran d'envoi d'un
    // pays fantôme nommé « conducteur ».
    for (const segment of ['conducteur', 'mot-du-jt', 'planning']) {
      expect(isCountrySegment(segment), segment).toBe(false);
    }
  });

  it('laisse l\'équipe montage sur tous les onglets', () => {
    for (const view of ['home', 'uploader', 'dashboard', 'voixoff', 'delivery', 'stats', 'editor', 'planning']) {
      expect(isViewAllowed(WORKSPACES.EDITOR, view)).toBe(true);
    }
  });

  it('expose une vue d\'accueil par espace', () => {
    expect(defaultViewFor(WORKSPACES.REPORTER)).toBe('hub');
    expect(defaultViewFor(WORKSPACES.EDITOR)).toBe('dashboard');
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

describe('routing — le pays porté par l\'URL', () => {
  it('ouvre l\'écran d\'envoi du pays sur /journalistes/ga', () => {
    expect(parsePath('/journalistes/ga')).toEqual({
      workspace: WORKSPACES.REPORTER,
      view: 'uploader',
      countryId: 'ga',
    });
  });

  it('accepte aussi ?pays=ga, plus facile à dicter au téléphone', () => {
    expect(parsePath('/journalistes', '?pays=ga').countryId).toBe('ga');
    expect(parsePath('/journalistes/telecharger-le-jt', '?pays=ci').countryId).toBe('ci');
  });

  it('ne confond jamais un segment de route avec un pays', () => {
    expect(parsePath('/journalistes/reportage').view).toBe('home');
    expect(parsePath('/journalistes/reportage').countryId).toBe('');
    expect(parsePath('/journalistes/telecharger-le-jt').view).toBe('delivery');
  });

  it('ignore un identifiant de pays mal formé', () => {
    expect(parsePath('/journalistes/CE-N-EST-PAS-UN-PAYS').countryId).toBe('');
    expect(parsePath('/journalistes', '?pays=../etc/passwd').countryId).toBe('');
  });

  it('écrit le lien personnel du correspondant', () => {
    expect(buildPath(WORKSPACES.REPORTER, 'uploader', 'ga')).toBe('/journalistes/ga');
    expect(buildPath(WORKSPACES.REPORTER, 'uploader')).toBe('/journalistes/reportage/envoi');
    expect(buildPath(WORKSPACES.REPORTER, 'delivery', 'ga')).toBe('/journalistes/telecharger-le-jt');
  });

  it('laisse l\'espace montage inchangé', () => {
    expect(buildPath(WORKSPACES.EDITOR, 'uploader', 'ga')).toBe('/monteurs/reportage/envoi');
  });
});
