import { describe, it, expect, beforeAll, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { TEST_UPLOADS_DIR } from './setup.js';
import { createApp } from '../src/app.js';
import { buildWeeks } from '../src/data/constants.js';
import {
  MAX_SONS, dureeSon, gainSousVoix, nettoyerPisteAudio, plagesSousVoix,
} from '../../remotion/src/pisteAudio.js';
import { buildRemotionPayload, completerDureesSons, verifierSons } from '../src/services/editorService.js';

// LE CONSTAT : le JT n'acceptait qu'une seule voix off, dont on tapait l'heure
// de départ en secondes. Impossible d'en poser deux, de les voir, de les caler
// sur l'image. La piste son les accepte toutes ; ses données viennent du
// navigateur, donc rien n'y passe qui ne soit connu et borné.

const son = (extra = {}) => ({
  id: 'son-1', filename: 'voix-gabon.mp3', name: 'Voix Gabon', role: 'voix',
  startTime: 4, inPoint: 1, outPoint: 9, sourceDurationSec: 12, volume: 0.8, attenuer: true, ...extra,
});

describe('la piste son — ce qu’on accepte de garder', () => {
  it('garde un son valide tel quel', () => {
    expect(nettoyerPisteAudio([son()])).toEqual([son()]);
  });

  it('retire un son dont le fichier est un chemin ou un fichier caché', () => {
    for (const filename of ['../../etc/passwd', 'a/b.mp3', 'a\\b.mp3', '.env', '', 42]) {
      expect(nettoyerPisteAudio([son({ filename })])).toEqual([]);
    }
  });

  it('jette les champs inconnus et ramène les valeurs hors bornes à leur défaut', () => {
    const [propre] = nettoyerPisteAudio([son({
      pirate: '<script>', role: 'admin', volume: 50, startTime: -3, inPoint: 'x', outPoint: 0.5, id: 'a b/c',
    })]);
    expect(propre).not.toHaveProperty('pirate');
    expect(propre.role).toBe('son');
    expect(propre.volume).toBe(1);
    expect(propre.startTime).toBe(0);
    expect(propre.inPoint).toBe(0);
    expect(propre.outPoint).toBe(0.5);
    expect(propre.id).toBe('son-1');
  });

  it('refuse une fin avant le début', () => {
    expect(nettoyerPisteAudio([son({ inPoint: 5, outPoint: 3 })])[0].outPoint).toBeNull();
  });

  it('une voix off baisse les plans par défaut, une musique non', () => {
    expect(nettoyerPisteAudio([son({ attenuer: undefined })])[0].attenuer).toBe(true);
    expect(nettoyerPisteAudio([son({ role: 'musique', attenuer: undefined })])[0].attenuer).toBe(false);
  });

  it('borne le nombre de sons', () => {
    expect(nettoyerPisteAudio(Array.from({ length: MAX_SONS + 20 }, (_, i) => son({ id: `s${i}` })))).toHaveLength(MAX_SONS);
    expect(nettoyerPisteAudio('pas une liste')).toEqual([]);
  });
});

describe('la piste son — le son des plans sous une voix off', () => {
  it('connaît la durée jouée d’un son', () => {
    expect(dureeSon(son())).toBe(8);
    expect(dureeSon(son({ outPoint: null }))).toBe(11);
    expect(dureeSon(son({ outPoint: null, sourceDurationSec: null }))).toBe(0);
  });

  it('ne baisse que sous les voix qui le demandent', () => {
    const plages = plagesSousVoix([son(), son({ id: 's2', attenuer: false, startTime: 30 })]);
    expect(plages).toEqual([{ debut: 4, fin: 12 }]);
  });

  it('baisse en douceur, tient, puis remonte', () => {
    const plages = [{ debut: 10, fin: 20 }];
    expect(gainSousVoix(5, plages)).toBe(1);
    expect(gainSousVoix(15, plages)).toBe(0.25);
    // À mi-rampe, la moitié de la baisse.
    expect(gainSousVoix(9.875, plages)).toBeCloseTo(0.625, 5);
    expect(gainSousVoix(20.125, plages)).toBeCloseTo(0.625, 5);
    expect(gainSousVoix(21, plages)).toBe(1);
  });
});

describe('la piste son — avant le rendu', () => {
  const dossier = () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'piste-'));
    fs.writeFileSync(path.join(d, 'voix-gabon.mp3'), 'x');
    return d;
  };

  it('nomme les sons effacés du serveur, avant de lancer deux heures de rendu', () => {
    const d = dossier();
    expect(() => verifierSons([son()], { dossier: d })).not.toThrow();
    expect(() => verifierSons([son(), son({ id: 's2', filename: 'parti.mp3', name: 'Voix Cameroun' })], { dossier: d }))
      .toThrow(/« Voix Cameroun »/);
  });

  it('mesure la durée d’un son quand le navigateur ne l’a pas donnée', async () => {
    const mesurer = vi.fn().mockResolvedValue(14.5);
    const [complet] = await completerDureesSons([son({ outPoint: null, sourceDurationSec: null })], { mesurer, dossier: dossier() });
    expect(complet.sourceDurationSec).toBe(14.5);
    expect(mesurer).toHaveBeenCalledTimes(1);
  });

  it('donne au moteur l’adresse de chaque son, sans jamais un chemin', () => {
    const avant = process.env.PUBLIC_API_URL;
    process.env.PUBLIC_API_URL = 'http://api.test';
    try {
      const payload = buildRemotionPayload([{ filename: 'r1.mp4', durationSec: 5 }], {
        audio: [son({ filename: 'voix #1?.mp3' }), son({ id: 's2', filename: '../secret.mp3' })],
      });
      expect(payload.audio).toHaveLength(1);
      expect(payload.audio[0].url).toBe('http://api.test/uploads/voix%20%231%3F.mp3');
    } finally {
      if (avant === undefined) delete process.env.PUBLIC_API_URL; else process.env.PUBLIC_API_URL = avant;
    }
  });
});

describe('la piste son — enregistrée avec le montage', () => {
  let app;
  let semaine;
  beforeAll(() => {
    semaine = buildWeeks()[0].id;
    app = createApp({ uploadsDir: TEST_UPLOADS_DIR, corsOrigins: ['http://localhost:5173'], enableMonitoring: false });
  });

  it('garde la piste nettoyée, et la rend au rechargement', async () => {
    const res = await request(app)
      .put(`/api/editor/timeline/${semaine}`)
      .send({ clips: [], overlays: [], branding: {}, audio: [son(), son({ id: 's2', filename: '../x.mp3' }), son({ id: 's3', pirate: 1 })] });
    expect(res.status).toBe(200);
    const lu = await request(app).get(`/api/editor/timeline/${semaine}`);
    expect(lu.body.workspace.audio.map((s) => s.id)).toEqual(['son-1', 's3']);
    expect(lu.body.workspace.audio[1]).not.toHaveProperty('pirate');
  });

  it('refuse une piste démesurée', async () => {
    const res = await request(app)
      .put(`/api/editor/timeline/${semaine}`)
      .send({ clips: [], overlays: [], branding: {}, audio: Array.from({ length: MAX_SONS + 1 }, (_, i) => son({ id: `s${i}` })) });
    expect(res.status).toBe(400);
  });
});
