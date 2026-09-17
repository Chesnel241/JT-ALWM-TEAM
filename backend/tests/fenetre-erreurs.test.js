import { describe, it, expect } from 'vitest';
import { creerFenetre, enregistrer, taux, FENETRE_PAR_DEFAUT_MS } from '../src/monitoring/fenetreErreurs.js';

/**
 * Le taux d'erreur des dernières minutes.
 *
 * L'INCIDENT
 * ----------
 * `alerts.js` déclarait `ERROR_RATE_WINDOW: 5 * 60 * 1000` et ne s'en servait
 * nulle part : `checkErrorRate()` divisait les compteurs cumulés **depuis le
 * démarrage**. Sur un serveur debout depuis une semaine, une rafale d'échecs
 * d'envoi un samedi soir ne déplace pas le ratio de cinq pour cent — l'alerte
 * ne pouvait pas se déclencher. C'était précisément le scénario qu'elle devait
 * couvrir.
 *
 * Module pur, testé comme des mathématiques : le temps est passé en argument.
 */

const T0 = 1_700_000_000_000; // un instant fixe, pour que rien ne dépende de l'horloge

describe('le taux d’erreur', () => {
  it('se calcule sur la fenêtre, pas depuis le démarrage', () => {
    // LE test du lot. Dix mille requêtes saines hier, puis dix erreurs sur
    // douze requêtes maintenant : le cumul donne 0,1 %, la fenêtre donne 83 %.
    const f = creerFenetre(5 * 60 * 1000);
    for (let i = 0; i < 10000; i += 1) {
      enregistrer(f, { maintenant: T0 + i, requetes: 1 });
    }
    const plusTard = T0 + 24 * 60 * 60 * 1000;
    for (let i = 0; i < 12; i += 1) {
      enregistrer(f, { maintenant: plusTard + i * 10, requetes: 1, erreurs: i < 10 ? 1 : 0 });
    }

    const r = taux(f, plusTard + 200);
    expect(r.requetes).toBe(12);
    expect(r.erreurs).toBe(10);
    expect(r.taux).toBeCloseTo(10 / 12, 5);
  });

  it('oublie ce qui sort de la fenêtre', () => {
    const f = creerFenetre(60 * 1000);
    enregistrer(f, { maintenant: T0, requetes: 100, erreurs: 50 });
    expect(taux(f, T0 + 30 * 1000).requetes).toBe(100);
    // Une minute plus tard, cette rafale n'a plus à peser sur le présent.
    expect(taux(f, T0 + 61 * 1000)).toEqual({ requetes: 0, erreurs: 0, taux: 0 });
  });

  it('redescend une fois la rafale passée', () => {
    // Le cumul ne le pouvait pas : franchi une fois, le seuil aurait demandé
    // des milliers de requêtes saines pour redevenir normal. Une alerte qui
    // ne s'éteint jamais finit ignorée.
    const f = creerFenetre(60 * 1000);
    enregistrer(f, { maintenant: T0, requetes: 10, erreurs: 10 });
    expect(taux(f, T0).taux).toBe(1);
    enregistrer(f, { maintenant: T0 + 70 * 1000, requetes: 10, erreurs: 0 });
    expect(taux(f, T0 + 70 * 1000).taux).toBe(0);
  });

  it('ne divise pas par zéro quand rien ne s’est passé', () => {
    expect(taux(creerFenetre(), T0)).toEqual({ requetes: 0, erreurs: 0, taux: 0 });
  });

  it('additionne ce qui arrive dans la même seconde', () => {
    const f = creerFenetre();
    enregistrer(f, { maintenant: T0, requetes: 1 });
    enregistrer(f, { maintenant: T0 + 300, requetes: 1, erreurs: 1 });
    enregistrer(f, { maintenant: T0 + 900, requetes: 1 });
    expect(f.seaux).toHaveLength(1);
    expect(taux(f, T0 + 900)).toMatchObject({ requetes: 3, erreurs: 1 });
  });
});

describe('la mémoire de la fenêtre', () => {
  it('reste bornée quel que soit le trafic', () => {
    // Retenir chaque requête une par une ferait grossir la mémoire du serveur
    // avec le trafic — et c'est justement les soirs de forte affluence qu'il
    // ne faut pas tomber. Un seau par seconde suffit.
    const f = creerFenetre(60 * 1000);
    for (let i = 0; i < 200000; i += 1) {
      enregistrer(f, { maintenant: T0 + i, requetes: 1 });
    }
    expect(f.seaux.length).toBeLessThanOrEqual(61);
    expect(taux(f, T0 + 199999).requetes).toBeGreaterThan(0);
  });
});

describe('ce qui pourrait la faire tomber', () => {
  it('encaisse une horloge qui recule', () => {
    // Un ajustement NTP sur un VPS n'est pas un cas d'école, et le gestionnaire
    // d'erreur est le dernier endroit où l'on peut se permettre de lever.
    const f = creerFenetre();
    enregistrer(f, { maintenant: T0 + 5000, requetes: 1 });
    expect(() => enregistrer(f, { maintenant: T0, requetes: 1, erreurs: 1 })).not.toThrow();
    expect(taux(f, T0 + 5000).requetes).toBe(2);
  });

  it('ignore un horodatage absurde plutôt que de se corrompre', () => {
    const f = creerFenetre();
    enregistrer(f, { maintenant: T0, requetes: 1 });
    enregistrer(f, { maintenant: NaN, requetes: 1 });
    enregistrer(f, { maintenant: undefined, erreurs: 1 });
    expect(taux(f, T0)).toMatchObject({ requetes: 1, erreurs: 0 });
  });

  it('retombe sur la durée par défaut si on lui en donne une absurde', () => {
    expect(creerFenetre(-1).dureeMs).toBe(FENETRE_PAR_DEFAUT_MS);
    expect(creerFenetre('cinq minutes').dureeMs).toBe(FENETRE_PAR_DEFAUT_MS);
  });
});

describe('l’alerte qui s’appuie dessus', () => {
  it('part sur une rafale, là où le cumul ne partait jamais', async () => {
    // L'incident, vu depuis la politique d'alerte : dix erreurs sur douze
    // requêtes dans la fenêtre. Sur les cumuls d'un serveur debout depuis une
    // semaine, ce même samedi soir ne déplaçait pas le ratio de 5 %.
    const { checkErrorRate, getAlertState } = await import('../src/monitoring/alerts.js');
    expect(checkErrorRate({ requetes: 12, erreurs: 10, taux: 10 / 12 })).toBe(false);
    // 12 requêtes, c'est sous le minimum d'échantillon : rien à conclure.
    expect(checkErrorRate({ requetes: 200, erreurs: 40, taux: 0.2 })).toBe(true);
    expect(getAlertState().errorRateAlert).toBe(true);
  });

  it('s’éteint quand la rafale est passée', () => {
    // Le cumul ne le pouvait pas non plus : une fois le seuil franchi, il
    // aurait fallu des milliers de requêtes saines pour redescendre.
    return import('../src/monitoring/alerts.js').then(({ checkErrorRate, getAlertState }) => {
      checkErrorRate({ requetes: 200, erreurs: 40, taux: 0.2 });
      expect(checkErrorRate({ requetes: 200, erreurs: 1, taux: 0.005 })).toBe(false);
      expect(getAlertState().errorRateAlert).toBe(false);
    });
  });

  it('ne crie pas sur trois requêtes de nuit', async () => {
    // Une erreur sur trois requêtes à 3 h du matin fait 33 %. Une alerte qui
    // réveille pour rien finit coupée — et c'est une panne de supervision de
    // plus.
    const { checkErrorRate } = await import('../src/monitoring/alerts.js');
    expect(checkErrorRate({ requetes: 3, erreurs: 1, taux: 1 / 3 })).toBe(false);
  });

  it('lit bien la fenêtre, et non les compteurs cumulés', async () => {
    // Le défaut d'origine tenait en une ligne : `errors_total / request_count`.
    const source = await import('node:fs').then((fs) => fs.readFileSync(
      new URL('../src/monitoring/alerts.js', import.meta.url), 'utf8'));
    const bloc = source.slice(source.indexOf('export function checkErrorRate'), source.indexOf('function checkDiskUsage'));
    expect(bloc).not.toMatch(/metricsData\.errors_total\s*\/|totalErrors\s*\/\s*totalRequests/);
    expect(bloc).toMatch(/lecture|tauxRecent/);
  });
});
