import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  CIBLE_SON, argsMesure, lireMesure, filtreCorrection, lireResultat, dansLaNorme,
} from '../../worker/src/sonorite.js';
import { nettoyerSon, finishJob, getJobState } from '../src/services/editorProgress.js';
import { normaliserSonMaster, lancerFfmpeg } from '../src/services/sonMaster.js';

// LE CONSTAT : aucune étape ne réglait le niveau du JT. Chaque reportage sortait
// au niveau que lui avait donné le correspondant, et la voix off était poussée
// à −14 LUFS, environ 9 LU au-dessus de la norme de diffusion (EBU R 128 :
// −23 LUFS, crête −1 dBTP).

const SORTIE_MESURE = `[Parsed_loudnorm_0 @ 0x55]
{
	"input_i" : "-16.22",
	"input_tp" : "-7.33",
	"input_lra" : "15.20",
	"input_thresh" : "-29.02",
	"output_i" : "-23.48",
	"output_tp" : "-14.50",
	"output_lra" : "14.10",
	"output_thresh" : "-34.20",
	"normalization_type" : "dynamic",
	"target_offset" : "0.87"
}`;

describe('la norme sonore du master — le calcul', () => {
  it('vise la norme de diffusion européenne', () => {
    expect(CIBLE_SON.integre).toBe(-23);
    expect(CIBLE_SON.crete).toBe(-1);
  });

  it('mesure le son seul, sans décoder l’image', () => {
    const args = argsMesure('/x/liste.txt', { concat: true });
    expect(args).toEqual(expect.arrayContaining(['-vn', '-f', 'null']));
    expect(args.join(' ')).toContain('-f concat -safe 0 -i /x/liste.txt');
    expect(args.join(' ')).toContain('loudnorm=I=-23:TP=-1');
  });

  it('lit la mesure de la première passe', () => {
    expect(lireMesure(SORTIE_MESURE)).toEqual({
      integre: -16.22, crete: -7.33, plage: 15.2, seuil: -29.02, decalage: 0.87,
    });
  });

  it('n’amplifie jamais un programme muet', () => {
    const muet = SORTIE_MESURE.replace('"-16.22"', '"-inf"');
    expect(lireMesure(muet)).toBeNull();
    expect(lireMesure(SORTIE_MESURE.replace('"-16.22"', '"-80.0"'))).toBeNull();
  });

  it('rend null sur une sortie illisible plutôt que d’inventer un gain', () => {
    expect(lireMesure('Error opening input')).toBeNull();
    expect(lireMesure('{ "input_i" : cassé }')).toBeNull();
  });

  it('applique un gain fixe calculé sur la mesure, puis revient à 48 kHz', () => {
    const filtre = filtreCorrection(lireMesure(SORTIE_MESURE));
    expect(filtre).toContain('measured_I=-16.22');
    expect(filtre).toContain('measured_TP=-7.33');
    expect(filtre).toContain('linear=true');
    // La plage visée couvre celle du programme : sinon loudnorm corrigerait en continu.
    expect(filtre).toContain('LRA=16');
    expect(filtre.endsWith(',aresample=48000')).toBe(true);
  });

  it('borne la plage visée entre 7 et 20 LU', () => {
    const base = lireMesure(SORTIE_MESURE);
    expect(filtreCorrection({ ...base, plage: 2 })).toContain('LRA=7:');
    expect(filtreCorrection({ ...base, plage: 35 })).toContain('LRA=20:');
  });

  it('lit ce que la seconde passe a réellement produit', () => {
    expect(lireResultat(SORTIE_MESURE)).toEqual({ integre: -23.48, crete: -14.5, mode: 'dynamic' });
  });

  it('accepte la tolérance de ±1 LU de la norme, pas au-delà', () => {
    expect(dansLaNorme(-23)).toBe(true);
    expect(dansLaNorme(-22.1)).toBe(true);
    expect(dansLaNorme(-21.5)).toBe(false);
    expect(dansLaNorme(Number.NaN)).toBe(false);
  });
});

describe('le bilan sonore — ce que le studio affiche', () => {
  it('ne garde que des nombres bornés et un mode connu', () => {
    expect(nettoyerSon({ avant: -16.23, apres: -23.04, crete: -1.27, mode: 'linear', norme: true, pirate: '<script>' }))
      .toEqual({ avant: -16.2, apres: -23, crete: -1.3, mode: 'linear', norme: true });
  });

  it('jette un bilan sans niveau final, ou aux valeurs absurdes', () => {
    expect(nettoyerSon(null)).toBeNull();
    expect(nettoyerSon({ avant: -20 })).toBeNull();
    expect(nettoyerSon({ apres: 'beaucoup' })).toBeNull();
    expect(nettoyerSon({ apres: -23, mode: 'n’importe quoi', norme: 'oui' })).toEqual({
      avant: null, apres: -23, crete: null, mode: null, norme: false,
    });
  });

  it('reste attaché au rendu terminé, pour le studio qui revient plus tard', () => {
    finishJob('job-son-1', 'done', '/uploads/exports/a.mp4', null, { avant: -18, apres: -23.1, crete: -1.4, mode: 'linear', norme: true });
    expect(getJobState('job-son-1').son).toEqual({ avant: -18, apres: -23.1, crete: -1.4, mode: 'linear', norme: true });
  });

  it('n’attache aucun bilan à un rendu échoué', () => {
    finishJob('job-son-2', 'error', null, 'raté', { apres: -23 });
    expect(getJobState('job-son-2').son).toBeNull();
  });
});

describe('le master du moteur de secours — correction en place', () => {
  const dossier = () => fs.mkdtempSync(path.join(os.tmpdir(), 'son-'));

  it('laisse le master intact quand la mesure échoue', async () => {
    const d = dossier();
    const master = path.join(d, 'm.mp4');
    fs.writeFileSync(master, 'original');
    const executer = vi.fn().mockResolvedValue({ code: 1, stderr: 'Error' });
    expect(await normaliserSonMaster(master, { executer })).toBeNull();
    expect(executer).toHaveBeenCalledTimes(1);
    expect(fs.readFileSync(master, 'utf8')).toBe('original');
  });

  it('garde le niveau d’origine si la correction échoue, sans fichier oublié', async () => {
    const d = dossier();
    const master = path.join(d, 'm.mp4');
    fs.writeFileSync(master, 'original');
    const executer = vi.fn()
      .mockResolvedValueOnce({ code: 0, stderr: SORTIE_MESURE })
      .mockImplementationOnce(async (args) => { fs.writeFileSync(args.at(-1), 'x'); return { code: 1, stderr: '' }; });
    expect(await normaliserSonMaster(master, { executer })).toBeNull();
    expect(fs.readFileSync(master, 'utf8')).toBe('original');
    expect(fs.readdirSync(d)).toEqual(['m.mp4']);
  });

  it('remplace le master par sa version corrigée et rend le bilan', async () => {
    const d = dossier();
    const master = path.join(d, 'm.mp4');
    fs.writeFileSync(master, 'original');
    const executer = vi.fn()
      .mockResolvedValueOnce({ code: 0, stderr: SORTIE_MESURE })
      .mockImplementationOnce(async (args) => {
        // L'image est copiée telle quelle : seul le son est réencodé.
        expect(args).toEqual(expect.arrayContaining(['-c:v', 'copy']));
        fs.writeFileSync(args.at(-1), Buffer.alloc(2048, 1));
        return { code: 0, stderr: SORTIE_MESURE.replace('"dynamic"', '"linear"').replace('"-23.48"', '"-23.02"') };
      });
    expect(await normaliserSonMaster(master, { executer })).toEqual({
      avant: -16.22, apres: -23.02, crete: -14.5, mode: 'linear', norme: true,
    });
    expect(fs.statSync(master).size).toBe(2048);
    expect(fs.readdirSync(d)).toEqual(['m.mp4']);
  });
});

const ffmpegDispo = spawnSync('ffmpeg', ['-hide_banner', '-filters'], { encoding: 'utf8' }).stdout?.includes('loudnorm');

describe('le master du moteur de secours — avec le vrai ffmpeg', () => {
  it.skipIf(!ffmpegDispo)('ramène un programme trop fort à −23 LUFS, à ±1 LU', async () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'son-reel-'));
    const master = path.join(d, 'm.mp4');
    // Un programme qui varie (fort, puis faible), comme un vrai JT.
    const fabrication = spawnSync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', 'color=c=blue:s=160x120:d=12',
      '-f', 'lavfi', '-i', 'sine=frequency=300:duration=12',
      '-f', 'lavfi', '-i', 'anoisesrc=d=12:a=0.2',
      '-filter_complex', "[1][2]amix=inputs=2:normalize=0,volume='if(lt(mod(t,6),3),0.9,0.15)':eval=frame[a]",
      '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-c:a', 'aac', '-shortest', master,
    ]);
    expect(fabrication.status).toBe(0);
    const bilan = await normaliserSonMaster(master, { executer: lancerFfmpeg });
    expect(bilan).not.toBeNull();
    expect(bilan.avant).toBeGreaterThan(-20);
    const verification = lireMesure((await lancerFfmpeg(argsMesure(master))).stderr);
    expect(dansLaNorme(verification.integre)).toBe(true);
  }, 60000);
});
