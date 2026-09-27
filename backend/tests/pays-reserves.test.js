import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import * as store from '../src/data/store.js';

/**
 * Les tiroirs des rubriques ne sont pas des pays.
 *
 * L'INCIDENT : `POST /api/countries`, ouverte à tous, acceptait `tj` et `mj`
 * — les identifiants de rangement du conducteur et du Mot du JT. Un « pays »
 * `mj` créé par n'importe qui rouvrait l'ancien écran d'envoi spécial, retiré
 * quand les rubriques ont cessé d'être des pays, et mêlait ses fichiers à ceux
 * de la rubrique.
 */

let app;
beforeAll(() => {
  app = createApp({ enableMonitoring: false });
});

describe('ajouter un pays', () => {
  it.each(['tj', 'mj', 'MJ', ' tj '])('refuse l’identifiant réservé « %s »', async (id) => {
    const res = await request(app).post('/api/countries').send({ id, name: 'Rubrique déguisée', code: 'XQ' });
    expect(res.status).toBe(400);
    expect(res.body.error || res.body.message).toMatch(/réservé/);
  });

  it('accepte toujours un vrai pays', async () => {
    const res = await request(app).post('/api/countries').send({ id: 'zz-test', name: 'Pays témoin', code: 'ZZT' });
    expect(res.status).toBe(201);
  });
});

describe('la liste des pays', () => {
  it('écarte un tiroir de rubrique déjà enregistré comme pays', async () => {
    // Un store d'avant ce correctif peut en contenir un.
    const espion = vi.spyOn(store, 'getCustomCountries').mockReturnValue([
      { id: 'mj', code: 'MJ', name: 'Mot du JT' },
      { id: 'bf', code: 'BF', name: 'Burkina Faso' },
    ]);
    try {
      const res = await request(app).get('/api/countries');
      const ids = res.body.map((c) => c.id);
      expect(ids).toContain('bf');
      expect(ids).not.toContain('mj');
      expect(ids).not.toContain('tj');
    } finally {
      espion.mockRestore();
    }
  });
});
