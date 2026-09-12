import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { extensionDepuisOctets, extensionDepuisType, extensionDuBlob } from '../src/lib/signatures.js';
import { UPLOAD_ACCEPT } from '../src/lib/mediaTypes.js';

/** En-tête ISO-BMFF avec la marque voulue en position 8. */
function iso(marque) {
  const a = new Uint8Array(64);
  a.set([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70], 0);
  a.set([...marque].map((c) => c.charCodeAt(0)), 8);
  return a;
}

function avec(octets, texteEn) {
  const a = new Uint8Array(64);
  a.set(octets, 0);
  if (texteEn) a.set([...texteEn.texte].map((c) => c.charCodeAt(0)), texteEn.offset);
  return a;
}

describe('reconnaissance du format sur les octets', () => {
  it('reconnaît ce que MediaRecorder produit réellement', () => {
    expect(extensionDepuisOctets(iso('M4A '))).toBe('.m4a');
    // Safari annonce « audio/aac » mais livre un conteneur MP4 : c'est le
    // cas qui refusait la voix off des iPhone.
    expect(extensionDepuisOctets(iso('isom'))).toBe('.m4a');
    expect(extensionDepuisOctets(avec([0x1a, 0x45, 0xdf, 0xa3], { texte: 'webm', offset: 16 }))).toBe('.webm');
    expect(extensionDepuisOctets(avec([0x4f, 0x67, 0x67, 0x53]))).toBe('.ogg');
  });

  it('sépare l’ADTS du MPEG Audio, que la seule synchronisation confond', () => {
    expect(extensionDepuisOctets(avec([0xff, 0xf1, 0x50, 0x80]))).toBe('.aac');
    expect(extensionDepuisOctets(avec([0xff, 0xf9, 0x50, 0x80]))).toBe('.aac');
    expect(extensionDepuisOctets(avec([0xff, 0xfb, 0x90, 0x00]))).toBe('.mp3');
    expect(extensionDepuisOctets(avec([0xff, 0xe3, 0x90, 0x00]))).toBe('.mp3');
  });

  it('ne prétend rien quand il ne reconnaît rien', () => {
    expect(extensionDepuisOctets(new Uint8Array(64))).toBe('');
    expect(extensionDepuisOctets(new Uint8Array(2))).toBe('');
    expect(extensionDepuisOctets(null)).toBe('');
  });

  it('retombe sur le type annoncé, jamais sur un format arbitraire', () => {
    expect(extensionDepuisType('audio/webm;codecs=opus')).toBe('.webm');
    expect(extensionDepuisType('audio/mp4')).toBe('.m4a');
    expect(extensionDepuisType('audio/aac')).toBe('.aac');
    expect(extensionDepuisType('')).toBe('');
  });

  it('lit un blob sans jamais échouer', async () => {
    const blob = new Blob([iso('M4A ')]);
    expect(await extensionDuBlob(blob, '.secours')).toBe('.m4a');
    // Blob illisible : on retombe sur le secours plutôt que de lever.
    const casse = { slice: () => ({ arrayBuffer: () => Promise.reject(new Error('nope')) }) };
    expect(await extensionDuBlob(casse, '.secours')).toBe('.secours');
  });
});

describe('le sélecteur propose exactement ce que le serveur accepte', () => {
  const CHEMIN_SERVEUR = '../backend/src/lib/upload.js';

  it.skipIf(!existsSync(CHEMIN_SERVEUR))('aucune extension d’un côté seulement', () => {
    // Une extension acceptée à l'arrivée mais absente d'ici apparaît grisée
    // dans le sélecteur du téléphone : le correspondant ne peut pas la
    // choisir, et croit son format refusé.
    const proposees = UPLOAD_ACCEPT.split(',').filter((e) => e.startsWith('.'));
    const acceptees = [...readFileSync(CHEMIN_SERVEUR, 'utf-8')
      .matchAll(/export const [A-Z_]+_EXTENSIONS = \[([\s\S]*?)\];/g)]
      .flatMap((m) => m[1].match(/'\.[a-z0-9]+'/g) || [])
      .map((s) => s.replaceAll("'", ''));

    expect(acceptees.filter((e) => !proposees.includes(e))).toEqual([]);
    expect(proposees.filter((e) => !acceptees.includes(e))).toEqual([]);
  });
});
