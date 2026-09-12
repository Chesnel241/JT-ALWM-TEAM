import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, rmSync } from 'fs';
import './setup.js';

/**
 * Deux personnes écrivent le conducteur en même temps.
 *
 * `setRubrique` était un « dernier qui écrit gagne » silencieux : celui qui
 * enregistrait en second effaçait le travail de l'autre sans que personne ne
 * l'apprenne. Le montage sait déjà faire mieux — chaque enregistrement de la
 * timeline porte un numéro, et l'appelant dit sur lequel il a travaillé. Les
 * rubriques reprennent exactement cette mécanique.
 */

const SEMAINE = '2026-w37';
const STORE_PATH = process.env.JT_STORE_PATH;

let store;

beforeEach(async () => {
  if (STORE_PATH && existsSync(STORE_PATH)) rmSync(STORE_PATH);
  vi.resetModules();
  store = await import('../src/data/store.js');
});

afterAll(() => {
  if (STORE_PATH && existsSync(STORE_PATH)) {
    try { rmSync(STORE_PATH); } catch { /* ignore */ }
  }
});

describe('la révision suit chaque enregistrement', () => {
  it('part de 0 et avance d’un cran à chaque écriture', () => {
    expect(store.getRubrique(SEMAINE, 'conducteur').revision).toBe(0);

    const premier = store.setRubrique(SEMAINE, 'conducteur', { texte: 'Plateau, puis Pikine.' });
    expect(premier.conflit).toBe(false);
    expect(premier.revision).toBe(1);
    expect(premier.majLe).toBeTruthy();
    expect(premier.champs.texte).toBe('Plateau, puis Pikine.');

    expect(store.setRubrique(SEMAINE, 'conducteur', { texte: 'Plateau.' }).revision).toBe(2);
    expect(store.getRubrique(SEMAINE, 'conducteur').revision).toBe(2);
  });
});

describe('deux écritures fondées sur la même révision', () => {
  it('refuse la seconde et rend l’état courant, sans rien écrire', () => {
    store.setRubrique(SEMAINE, 'conducteur', { texte: 'Version de départ.' });
    const base = store.getRubrique(SEMAINE, 'conducteur').revision;

    const godsway = store.setRubrique(SEMAINE, 'conducteur', { texte: 'Écrit par Godsway.' }, { baseRevision: base });
    expect(godsway.conflit).toBe(false);
    expect(godsway.revision).toBe(base + 1);

    // Chesnel avait ouvert la même version : on ne lui laisse pas effacer
    // Godsway, on lui rend ce qui est en place pour qu'il fusionne.
    const chesnel = store.setRubrique(SEMAINE, 'conducteur', { texte: 'Écrit par Chesnel.' }, { baseRevision: base });
    expect(chesnel.conflit).toBe(true);
    expect(chesnel.revision).toBe(base + 1);
    expect(chesnel.champs.texte).toBe('Écrit par Godsway.');
    expect(chesnel.majLe).toBe(godsway.majLe);

    // Rien n'a bougé au store : le refus est bien un refus d'écrire.
    expect(store.getRubrique(SEMAINE, 'conducteur').texte).toBe('Écrit par Godsway.');
    expect(store.getRubrique(SEMAINE, 'conducteur').revision).toBe(base + 1);
  });

  it('laisse passer celui qui s’est rechargé entre-temps', () => {
    store.setRubrique(SEMAINE, 'conducteur', { texte: 'Version de départ.' });
    const courante = store.getRubrique(SEMAINE, 'conducteur').revision;

    const apresRechargement = store.setRubrique(
      SEMAINE, 'conducteur', { texte: 'Fusion des deux.' }, { baseRevision: courante },
    );
    expect(apresRechargement.conflit).toBe(false);
    expect(apresRechargement.champs.texte).toBe('Fusion des deux.');
  });

  it('accepte la révision 0 sur une rubrique jamais écrite', () => {
    const res = store.setRubrique(SEMAINE, 'motDuJt', { orateur: 'M. Nguema' }, { baseRevision: 0 });
    expect(res.conflit).toBe(false);
    expect(res.revision).toBe(1);
  });
});

describe('un client qui n’envoie pas `baseRevision`', () => {
  it('écrit toujours, comme avant', () => {
    store.setRubrique(SEMAINE, 'conducteur', { texte: 'Un.' });
    store.setRubrique(SEMAINE, 'conducteur', { texte: 'Deux.' }, { baseRevision: 1 });

    // Il ne sait rien des révisions : on ne le bloque pas pour autant.
    const res = store.setRubrique(SEMAINE, 'conducteur', { texte: 'Trois.' });
    expect(res.conflit).toBe(false);
    expect(res.revision).toBe(3);
    expect(store.getRubrique(SEMAINE, 'conducteur').texte).toBe('Trois.');
  });
});

describe('la fusion des champs reste intacte', () => {
  it('n’efface pas un champ que l’appelant n’a pas envoyé', () => {
    store.setRubrique(SEMAINE, 'conducteur', { texte: 'Le conducteur.' });
    const res = store.setRubrique(SEMAINE, 'conducteur', { texteVoixOff: 'Bonsoir à tous.' });

    expect(res.champs.texte).toBe('Le conducteur.');
    expect(res.champs.texteVoixOff).toBe('Bonsoir à tous.');
    // `revision` et `majLe` sont du protocole : ils ne se mêlent pas au
    // contenu de la rubrique.
    expect(res.champs.revision).toBeUndefined();
    expect(res.champs.majLe).toBeUndefined();
  });

  it('rend aussi l’état courant en cas de conflit sans perdre de champ', () => {
    store.setRubrique(SEMAINE, 'motDuJt', { orateur: 'M. Nguema', theme: 'Éducation' });
    const conflit = store.setRubrique(SEMAINE, 'motDuJt', { theme: 'Santé' }, { baseRevision: 0 });

    expect(conflit.conflit).toBe(true);
    expect(conflit.champs).toEqual({ orateur: 'M. Nguema', theme: 'Éducation' });
  });
});
