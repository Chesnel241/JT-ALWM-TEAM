import { describe, it, expect } from 'vitest';
import {
  contexteRequete,
  expurgerEvenement,
  expurgerProfond,
  masquerAdresses,
  masquerParams,
  REMPLACEMENT,
} from '../src/monitoring/expurge.js';

/**
 * Ce qui ne doit jamais quitter la machine.
 *
 * L'INCIDENT
 * ----------
 * Sentry est un sous-traitant tiers. Deux choses ne doivent pas y arriver, et
 * elles n'empruntent pas le même chemin :
 *
 * - **le mot de passe d'administration**, qui voyage dans `X-Admin-Password`
 *   (et, sous d'anciennes formes, dans une query string). Un événement d'erreur
 *   emporte la requête qui l'a provoqué ;
 * - **les adresses des correspondants**, qui n'arrivent par aucun en-tête mais
 *   par le message de l'exception lui-même — « contact introuvable pour … ».
 *   Ce sont les adresses de gens dans sept pays qui n'ont pas choisi Sentry.
 *
 * Module pur : testé comme des mathématiques, sans rien monter.
 */

describe('les adresses électroniques', () => {
  it('sont masquées dans un texte', () => {
    expect(masquerAdresses('contact introuvable pour marie.douala@example.org'))
      .toBe('contact introuvable pour [adresse expurgée]');
  });

  it('le sont toutes, pas seulement la première', () => {
    // Un message d'erreur de rapprochement en cite volontiers deux.
    const masque = masquerAdresses('a@x.org et b+tag@sous.domaine.cm diffèrent');
    expect(masque).not.toMatch(/@x\.org|@sous\.domaine\.cm/);
    expect(masque.match(/\[adresse expurgée\]/g)).toHaveLength(2);
  });

  it('laissent intact un texte qui n’en contient pas', () => {
    // Un test qui masque tout passerait aussi : il faut qu'il rende le reste.
    expect(masquerAdresses('rendu échoué sur le plan 3')).toBe('rendu échoué sur le plan 3');
  });

  it('sont masquées à n’importe quelle profondeur', () => {
    // Elles se logent dans une miette de navigation, un corps de requête, une
    // étiquette — jamais à l'endroit qu'on surveille.
    const evenement = { a: { b: [{ c: 'écrire à paul@alwm.tv' }] } };
    expurgerProfond(evenement);
    expect(evenement.a.b[0].c).toBe('écrire à [adresse expurgée]');
  });

  it('n’enferment pas le parcours dans un cycle', () => {
    // Un événement Sentry en contient : sans garde, la fonction boucle et le
    // serveur tombe au moment précis où il essayait de signaler une panne.
    const noeud = { texte: 'ici jean@alwm.tv' };
    noeud.soi = noeud;
    expect(() => expurgerProfond(noeud)).not.toThrow();
    expect(noeud.texte).toBe('ici [adresse expurgée]');
  });
});

describe('les secrets d’un événement', () => {
  it('ne partent pas par les en-têtes', () => {
    const evenement = {
      request: {
        headers: {
          'X-Admin-Password': 'montage-super-secret',
          'x-worker-key': 'abcdef',
          Authorization: 'Bearer zzz',
          Cookie: 'sid=1',
          'user-agent': 'Firefox',
        },
      },
    };
    expurgerEvenement(evenement);
    const entetes = evenement.request.headers;
    expect(entetes['X-Admin-Password']).toBe(REMPLACEMENT);
    expect(entetes['x-worker-key']).toBe(REMPLACEMENT);
    expect(entetes.Authorization).toBe(REMPLACEMENT);
    expect(entetes.Cookie).toBe(REMPLACEMENT);
    // Et ce qui n'est pas un secret reste lisible, sinon l'erreur devient
    // inexploitable.
    expect(entetes['user-agent']).toBe('Firefox');
  });

  it('ne partent pas par la query string', () => {
    // Forme héritée : le mot de passe passait en paramètre d'URL, et un 5xx
    // pendant un téléchargement l'écrivait en clair.
    expect(masquerParams('adminPassword=secret&week=2026-w38'))
      .toBe(`adminPassword=${REMPLACEMENT}&week=2026-w38`);
    expect(masquerParams('a=1&dl_token=xyz')).toBe(`a=1&dl_token=${REMPLACEMENT}`);
  });

  it('ne partent pas non plus par l’URL de l’événement', () => {
    const evenement = { request: { url: '/api/uploads?dl_token=xyz' } };
    expurgerEvenement(evenement);
    expect(evenement.request.url).not.toMatch(/xyz/);
  });
});

describe('le contexte joint à un rapport', () => {
  it('situe la requête sans emporter ses secrets', () => {
    // On choisit ce qui part, plutôt que d'expurger ce qu'un SDK a décidé de
    // prendre. Même discipline qu'`errorHandlerMiddleware`, qui journalise
    // `req.path` et jamais `req.originalUrl`.
    const ctx = contexteRequete({
      method: 'POST',
      path: '/api/editor/render',
      url: '/api/editor/render?dl_token=xyz',
      get: (n) => (n === 'user-agent' ? 'Chrome/140' : undefined),
      headers: { 'x-admin-password': 'montage' },
    });
    expect(ctx).toEqual({
      methode: 'POST',
      chemin: '/api/editor/render',
      avecParametres: true,
      navigateur: 'Chrome/140',
    });
    expect(JSON.stringify(ctx)).not.toMatch(/xyz|montage/);
  });

  it('tient debout sur une requête incomplète', () => {
    // Le gestionnaire d'erreur est le dernier endroit où l'on peut se
    // permettre de lever.
    expect(() => contexteRequete(undefined)).not.toThrow();
    expect(() => contexteRequete({ get() { throw new Error('non'); } })).not.toThrow();
  });

  it('borne la chaîne du navigateur', () => {
    const ctx = contexteRequete({ method: 'GET', path: '/', url: '/', get: () => 'x'.repeat(5000) });
    expect(ctx.navigateur.length).toBe(200);
  });
});
