import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { TEST_UPLOADS_DIR } from './setup.js';
import { semaineActive } from './semaine.js';
import {
  TEXT_ANIMATIONS_IDS,
  ANIMATIONS_HERITEES,
  normaliserAnimation,
} from '../src/data/overlayTemplates.js';
import {
  TEXT_ANIMATIONS_IN,
  TEXT_ANIMATIONS_LOOP,
  TEXT_ANIMATIONS_OUT,
} from '../../frontend/src/data/overlayTemplates.js';

/**
 * Ce que le studio propose doit être ce que le serveur accepte.
 *
 * Les deux listes vivent dans deux fichiers, l'un côté serveur et l'autre
 * côté studio, et elles avaient dérivé : « Slide Left », « Slide Right » et
 * « Allumage Néon » figuraient dans le menu du monteur sans figurer dans la
 * liste blanche du validateur. Les choisir faisait répondre 400 à
 * `/editor/concat` : « Générer le master » échouait, sans que rien n'indique
 * que le coupable était le menu déroulant d'à côté.
 *
 * Aucun test ne comparait les deux listes. Celui-ci le fait.
 */

const ADMIN = 'mot-de-passe-montage';
const SEMAINE = semaineActive();

let app;

beforeAll(async () => {
  vi.resetModules();
  process.env.NODE_ENV = 'development';
  process.env.ADMIN_PASSWORD = ADMIN;

  const { createApp } = await import('../src/app.js');
  app = createApp({ uploadsDir: TEST_UPLOADS_DIR, corsOrigins: ['http://localhost:5173'], enableMonitoring: false });
});

afterAll(() => {
  process.env.NODE_ENV = 'test';
  delete process.env.ADMIN_PASSWORD;
  vi.resetModules();
});

function monter(animation) {
  return request(app)
    .post('/api/editor/concat')
    .set('X-Admin-Password', ADMIN)
    .send({
      jobId: `test-${animation}-${Date.now()}`,
      weekId: SEMAINE,
      clips: [{
        filename: 'un-rush.mp4',
        overlays: [{ templateId: 'titre_reportage', animation, fields: { titre: 'Douala' } }],
      }],
    });
}

describe('les deux listes d’animations', () => {
  it('le studio ne propose aucune animation que le serveur refuse', () => {
    const refusees = TEXT_ANIMATIONS_IN
      .map((a) => a.id)
      .filter((id) => !TEXT_ANIMATIONS_IDS.includes(id));

    // Le message nomme les coupables : une liste vide ne dit pas laquelle
    // ajouter ou retirer.
    expect(refusees, `proposées au monteur mais refusées par le serveur : ${refusees.join(', ')}`)
      .toEqual([]);
  });

  it('chaque animation du menu est réellement acceptée par la route', async () => {
    // Le test précédent compare deux tableaux ; celui-ci interroge la route,
    // seule autorité sur ce qui passe. Si le validateur cessait de lire
    // TEXT_ANIMATIONS_IDS, le premier test resterait vert et celui-ci non.
    for (const { id } of TEXT_ANIMATIONS_IN) {
      const res = await monter(id);
      expect(res.status, `l’animation « ${id} » est proposée au monteur`).toBe(202);
    }
  });

  it('accepte encore les valeurs héritées, pour ne pas bloquer un montage déjà enregistré', async () => {
    // Un montage écrit avant la correction porte « slide_left » dans sa
    // timeline. Le refuser aujourd'hui le rendrait définitivement
    // inexportable : le monteur n'a aucun moyen de rouvrir le menu pour
    // changer une valeur qui n'y figure plus.
    for (const id of Object.keys(ANIMATIONS_HERITEES)) {
      const res = await monter(id);
      expect(res.status, `valeur héritée « ${id} »`).toBe(202);
    }
  });

  it('ne propose plus les valeurs héritées dans le menu', () => {
    const proposees = TEXT_ANIMATIONS_IN.map((a) => a.id);
    Object.keys(ANIMATIONS_HERITEES).forEach((id) => {
      expect(proposees).not.toContain(id);
    });
  });

  it('ramène une valeur héritée à son équivalent connu', () => {
    expect(normaliserAnimation('slide_left')).toBe('slide');
    expect(normaliserAnimation('slide_right')).toBe('slide');
    expect(normaliserAnimation('neon_on')).toBe('fade');
    // Tout le reste passe intact, y compris ce qu'on ne connaît pas.
    expect(normaliserAnimation('fade')).toBe('fade');
    expect(normaliserAnimation('mask_reveal')).toBe('mask_reveal');
  });

  it('refuse toujours une animation inventée', async () => {
    // La tolérance ne doit pas devenir un blanc-seing : une valeur qui ne
    // vient ni du menu ni de l'historique reste une erreur d'appelant.
    const res = await monter('tourbillon_arc_en_ciel');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/animation/i);
  });
});

describe('les menus non validés', () => {
  it('boucle et sortie restent des listes non vides et sans doublon', () => {
    // Le serveur ne valide que l'animation d'entrée : boucle et sortie
    // voyagent en texte libre et ne peuvent pas faire échouer un export.
    // Rien ne garantit en revanche leur cohérence interne.
    //
    // Les libellés ne sont plus vérifiés ici : ils ont quitté les données pour
    // le dictionnaire du studio, qui les tient dans les deux langues. Une
    // chaîne écrite à deux endroits finit toujours par diverger.
    [TEXT_ANIMATIONS_LOOP, TEXT_ANIMATIONS_OUT].forEach((liste) => {
      const ids = liste.map((a) => a.id);
      expect(ids.length).toBeGreaterThan(0);
      expect(new Set(ids).size).toBe(ids.length);
      liste.forEach((a) => expect(typeof a.id).toBe('string'));
    });
  });
});
