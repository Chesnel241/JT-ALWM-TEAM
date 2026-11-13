import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CARTON, DUREE_MAX_CARTON } from '../../remotion/src/plans.js';
import { buildRemotionPayload, verifierPlans } from '../src/services/editorService.js';

// LE CONSTAT : le fond des « Titres » est opaque ; posé sur un reportage, il en
// masquait les images. Le carton leur donne leur place : un plan sans fichier,
// que le serveur ne doit ni chercher sur le disque ni refuser.

const carton = (duree) => ({ filename: CARTON, name: 'Les titres', inPoint: 0, outPoint: duree, durationSec: duree, overlays: [] });

describe('le carton côté serveur', () => {
  it('passe la vérification des plans sans fichier, et sans être mesuré', async () => {
    const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'carton-'));
    fs.writeFileSync(path.join(dossier, 'r1.mp4'), 'x');
    const mesurer = vi.fn().mockResolvedValue(30);
    const plans = await verifierPlans([carton(6), { filename: 'r1.mp4', inPoint: 0, outPoint: 10 }], { mesurer, dossier });
    expect(plans[0]).toMatchObject({ filename: CARTON, inPoint: 0, outPoint: 6, durationSec: 6 });
    expect(mesurer).toHaveBeenCalledTimes(1);
  });

  it('borne sa durée', async () => {
    const [court] = await verifierPlans([carton(0.05)], { mesurer: vi.fn(), dossier: os.tmpdir() });
    const [long] = await verifierPlans([carton(99999)], { mesurer: vi.fn(), dossier: os.tmpdir() });
    expect(court.durationSec).toBe(0.3);
    expect(long.durationSec).toBe(DUREE_MAX_CARTON);
  });

  it('arrive au moteur sans adresse : le moteur dessine le fond lui-même', () => {
    const payload = buildRemotionPayload([carton(6)], {});
    expect(payload.clips[0].url).toBe('');
  });
});
