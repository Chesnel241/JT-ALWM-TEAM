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
    // Les en-têtes de la requête ne sont pas expurgés : ils sont **retirés**.
    // C'est la liste blanche — on garde ce qu'on a choisi (méthode, chemin) et
    // on jette le reste. Le navigateur, lui, survit par `contexts.requete`,
    // que `contexteRequete` compose exprès.
    const evenement = {
      request: {
        method: 'GET',
        url: '/api/weeks',
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
    expect(evenement.request.headers).toBeUndefined();
    expect(JSON.stringify(evenement)).not.toMatch(/montage-super-secret|abcdef|Bearer zzz/);
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

describe('la requête jointe à un événement', () => {
  it('ne part pas avec le corps brut', () => {
    // L'INCIDENT, trouvé au banc à travers la vraie application : le SDK
    // attache `request.data`, c'est-à-dire le corps entier de la requête. Un
    // jeton de téléchargement recopié dans un signalement du studio était parti
    // tel quel — et ce n'est pas le pire cas : n'importe quel POST y passerait,
    // les coordonnées d'un correspondant comme le texte d'un conducteur.
    const evenement = {
      request: {
        method: 'POST',
        url: 'http://exemple.org/api/client-error?dl_token=JETON',
        data: '{"url":"/studio?dl_token=JETON-SECRET","contact":"marie@example.org"}',
        cookies: { sid: '1' },
        headers: { 'x-admin-password': 'montage' },
        query_string: 'dl_token=JETON',
      },
    };
    expurgerEvenement(evenement);

    // Liste blanche : on garde ce qu'on a choisi, on jette le reste. Expurger
    // champ par champ supposerait de connaître d'avance tout ce que le SDK
    // ajoutera un jour.
    expect(Object.keys(evenement.request).sort()).toEqual(['method', 'url']);
    expect(JSON.stringify(evenement)).not.toMatch(/JETON|montage|marie@example\.org/);
  });

  it('garde de quoi situer la panne', () => {
    // Un test qui supprime tout passerait aussi. La méthode et le chemin
    // restent, sinon l'événement devient inexploitable.
    const evenement = { request: { method: 'GET', url: 'http://exemple.org/api/weeks?a=1' } };
    expurgerEvenement(evenement);
    expect(evenement.request).toEqual({ method: 'GET', url: 'http://exemple.org/api/weeks' });
  });
});

describe('les jetons ailleurs que dans la query string', () => {
  it('sont masqués dans n’importe quelle chaîne', () => {
    // Un jeton ne se trouve pas seulement dans le champ nommé « query_string ».
    // Il arrive recopié dans un corps, une miette de navigation, un message.
    const evenement = { breadcrumbs: [{ message: 'GET /fichier?dl_token=abc123 a échoué' }] };
    expurgerProfond(evenement);
    expect(evenement.breadcrumbs[0].message).not.toMatch(/abc123/);
  });

  it('comme les en-têtes sensibles, à quelque profondeur qu’ils soient', () => {
    const evenement = { contexts: { response: { headers: { 'X-Admin-Password': 'montage' } } } };
    expurgerProfond(evenement);
    expect(evenement.contexts.response.headers['X-Admin-Password']).toBe(REMPLACEMENT);
  });
});
