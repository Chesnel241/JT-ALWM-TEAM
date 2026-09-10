import { describe, it, expect } from 'vitest';
import {
  classifyFile,
  splitByMediaType,
  groupByReportage,
  MEDIA_TYPES,
  MEDIA_ORDER,
} from '../src/lib/mediaTypes.js';
import { reportageTone, REPORTAGE_TONES } from '../src/lib/branding.js';

describe('classement des fichiers reçus', () => {
  it('reconnaît les vidéos, y compris les formats de téléphones modestes', () => {
    for (const name of ['a.mp4', 'b.MOV', 'c.mkv', 'd.3gp', 'e.MTS', 'f.avi', 'g.webm']) {
      expect(classifyFile({ name })).toBe(MEDIA_TYPES.VIDEO);
    }
  });

  it('reconnaît les images, dont le HEIC des iPhone', () => {
    for (const name of ['a.jpg', 'b.PNG', 'c.heic', 'd.webp', 'e.tiff', 'f.avif']) {
      expect(classifyFile({ name })).toBe(MEDIA_TYPES.IMAGE);
    }
  });

  it('reconnaît les audios, dont l\'AMR des enregistreurs Android', () => {
    for (const name of ['a.mp3', 'b.WAV', 'c.m4a', 'd.amr', 'e.opus', 'f.flac']) {
      expect(classifyFile({ name })).toBe(MEDIA_TYPES.AUDIO);
    }
  });

  it('range le reste dans les documents plutôt que de le perdre', () => {
    for (const name of ['script.txt', 'note.docx', 'plan.pdf', 'archive.zip', 'inconnu.xyz']) {
      expect(classifyFile({ name })).toBe(MEDIA_TYPES.DOCUMENT);
    }
  });

  it('retombe sur le type déclaré quand le nom ne dit rien', () => {
    expect(classifyFile({ name: 'sans-extension', type: 'video/mp4' })).toBe(MEDIA_TYPES.VIDEO);
    expect(classifyFile({ name: 'sans-extension', type: 'image/png' })).toBe(MEDIA_TYPES.IMAGE);
    expect(classifyFile(null)).toBe(MEDIA_TYPES.DOCUMENT);
  });

  it('sépare les quatre familles', () => {
    const out = splitByMediaType([{ name: 'a.mp4' }, { name: 'b.png' }, { name: 'c.mp3' }, { name: 'd.txt' }]);
    expect(MEDIA_ORDER.map((t) => out[t].length)).toEqual([1, 1, 1, 1]);
  });
});

describe('regroupement par reportage', () => {
  const FILES = [
    { name: 'v2.mp4', reportage: 'Reportage 2' },
    { name: 'i1.jpg', reportage: 'Reportage 1' },
    { name: 'a1.amr', reportage: 'Reportage 1' },
    { name: 's1.txt', reportage: 'Reportage 1' },
    { name: 'ann.mp4', reportage: 'Annonces' },
    { name: 'vieux.txt' },
  ];

  it('classe chaque reportage puis chaque famille à l\'intérieur', () => {
    const groups = groupByReportage(FILES);
    const r1 = groups.find((g) => g.label === 'Reportage 1');
    expect(r1.byType[MEDIA_TYPES.IMAGE]).toHaveLength(1);
    expect(r1.byType[MEDIA_TYPES.AUDIO]).toHaveLength(1);
    expect(r1.byType[MEDIA_TYPES.DOCUMENT]).toHaveLength(1);
    expect(r1.byType[MEDIA_TYPES.VIDEO]).toHaveLength(0);
  });

  it('ordonne les reportages, puis les rubriques, puis les orphelins', () => {
    expect(groupByReportage(FILES).map((g) => g.label))
      .toEqual(['Reportage 1', 'Reportage 2', 'Annonces', 'Sans section']);
  });

  it('donne une teinte distincte à chaque reportage', () => {
    const tones = [0, 1, 2, 3, 4].map((i) => reportageTone(i).fill);
    expect(new Set(tones).size).toBe(5);
    expect(reportageTone(5).fill).toBe(REPORTAGE_TONES[0].fill);
    expect(reportageTone(undefined).fill).toBe(REPORTAGE_TONES[0].fill);
  });
});
