/**
 * De vrais fichiers, un par format que la plateforme annonce accepter.
 *
 * Pas des fichiers vides renommés : de vraies vidéos, de vrais sons, de vraies
 * images, produits par ffmpeg avec le codec qu'utilise réellement l'appareil
 * d'où ils viennent (H.263 et AAC d'un vieil Android en 3GP, WMV d'un PC
 * Windows, AVCHD d'un caméscope en MTS…). La liste doit couvrir celle du
 * serveur (`backend/src/lib/upload.js`) : un test le vérifie.
 *
 * Deux exceptions, écrites à la main faute d'encodeur libre : l'AMR (le
 * dictaphone des Android d'entrée de gamme, ici des trames AMR-NB valides) et
 * le HEIC/HEIF des iPhone, versé tel quel dans `e2e/fichiers-fixes/`.
 */
import { spawnSync } from 'child_process';
import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { DOSSIER_FICHIERS } from './banc.mjs';

const ICI = dirname(fileURLToPath(import.meta.url));
const FIXES = join(ICI, '../fichiers-fixes');

/** ffmpeg du système s'il y en a un, sinon celui livré avec le serveur. */
function trouverFfmpeg() {
  if (spawnSync('ffmpeg', ['-version']).status === 0) return 'ffmpeg';
  const require = createRequire(join(ICI, '../../../backend/package.json'));
  return require('ffmpeg-static');
}

const IMAGE = ['-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=25:duration=2'];
const SON = ['-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100:duration=2'];
const AV = [...IMAGE, ...SON, '-shortest'];
const PHOTO = ['-f', 'lavfi', '-i', 'testsrc2=size=320x240', '-frames:v', '1'];
const H264 = ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'veryfast'];
const AAC = ['-c:a', 'aac', '-b:a', '96k'];

/**
 * `famille` : le rangement attendu côté montage (video, audio, image, script).
 * `lisible` : le navigateur sait l'afficher tel quel ; sinon c'est l'aperçu
 * fabriqué par le serveur (vidéo) ou le téléchargement qui prend le relais.
 */
export const FORMATS = [
  // Vidéo
  { nom: 'telephone.mp4', famille: 'video', type: 'video/mp4', args: [...AV, ...H264, ...AAC] },
  { nom: 'iphone.mov', famille: 'video', type: 'video/quicktime', args: [...AV, ...H264, ...AAC, '-f', 'mov'] },
  { nom: 'itunes.m4v', famille: 'video', type: 'video/x-m4v', args: [...AV, ...H264, ...AAC, '-f', 'mp4', '-brand', 'M4V '] },
  { nom: 'flash.f4v', famille: 'video', type: 'video/mp4', args: [...AV, ...H264, ...AAC, '-f', 'mp4'] },
  { nom: 'camera.avi', famille: 'video', type: 'video/x-msvideo', args: [...AV, '-c:v', 'mpeg4', '-q:v', '5', '-c:a', 'libmp3lame', '-f', 'avi'] },
  { nom: 'ancien.divx', famille: 'video', type: 'video/x-msvideo', args: [...AV, '-c:v', 'mpeg4', '-vtag', 'DIVX', '-c:a', 'libmp3lame', '-f', 'avi'] },
  { nom: 'montage.mkv', famille: 'video', type: 'video/x-matroska', args: [...AV, ...H264, '-c:a', 'libvorbis', '-f', 'matroska'] },
  { nom: 'navigateur.webm', famille: 'video', type: 'video/webm', args: [...AV, '-c:v', 'libvpx-vp9', '-b:v', '300k', '-deadline', 'realtime', '-c:a', 'libopus', '-f', 'webm'] },
  { nom: 'dvd.mpg', famille: 'video', type: 'video/mpeg', args: [...AV, '-c:v', 'mpeg2video', '-c:a', 'mp2', '-f', 'mpeg'] },
  { nom: 'dvd.mpeg', famille: 'video', type: 'video/mpeg', args: [...AV, '-c:v', 'mpeg1video', '-c:a', 'mp2', '-f', 'mpeg'] },
  { nom: 'ancien.mpe', famille: 'video', type: 'video/mpeg', args: [...AV, '-c:v', 'mpeg1video', '-c:a', 'mp2', '-f', 'mpeg'] },
  { nom: 'dvd.vob', famille: 'video', type: 'video/mpeg', args: [...AV, '-c:v', 'mpeg2video', '-c:a', 'ac3', '-f', 'vob'] },
  { nom: 'android.3gp', famille: 'video', type: 'video/3gpp', args: ['-f', 'lavfi', '-i', 'testsrc2=size=176x144:rate=15:duration=2', ...SON, '-shortest', '-c:v', 'h263', '-c:a', 'aac', '-ar', '22050', '-f', '3gp'] },
  { nom: 'android.3g2', famille: 'video', type: 'video/3gpp2', args: ['-f', 'lavfi', '-i', 'testsrc2=size=176x144:rate=15:duration=2', ...SON, '-shortest', '-c:v', 'h263', '-c:a', 'aac', '-ar', '22050', '-f', '3g2'] },
  { nom: 'windows.wmv', famille: 'video', type: 'video/x-ms-wmv', args: [...AV, '-c:v', 'wmv2', '-c:a', 'wmav2', '-f', 'asf'] },
  { nom: 'windows.asf', famille: 'video', type: 'video/x-ms-asf', args: [...AV, '-c:v', 'wmv2', '-c:a', 'wmav2', '-f', 'asf'] },
  { nom: 'flash.flv', famille: 'video', type: 'video/x-flv', args: [...AV, '-c:v', 'flv', '-c:a', 'libmp3lame', '-ar', '44100', '-f', 'flv'] },
  { nom: 'diffusion.ts', famille: 'video', type: 'video/mp2t', args: [...AV, ...H264, ...AAC, '-f', 'mpegts'] },
  { nom: 'camescope.mts', famille: 'video', type: 'video/mp2t', args: [...AV, ...H264, '-c:a', 'ac3', '-f', 'mpegts', '-mpegts_m2ts_mode', '1'] },
  { nom: 'camescope.m2ts', famille: 'video', type: 'video/mp2t', args: [...AV, ...H264, '-c:a', 'ac3', '-f', 'mpegts', '-mpegts_m2ts_mode', '1'] },
  { nom: 'libre.ogv', famille: 'video', type: 'video/ogg', args: [...AV, '-c:v', 'libtheora', '-q:v', '5', '-c:a', 'libvorbis', '-f', 'ogg'] },

  // Son
  { nom: 'interview.mp3', famille: 'audio', type: 'audio/mpeg', args: [...SON, '-c:a', 'libmp3lame', '-b:a', '96k', '-f', 'mp3'] },
  { nom: 'enregistreur.wav', famille: 'audio', type: 'audio/wav', args: [...SON, '-c:a', 'pcm_s16le', '-f', 'wav'] },
  { nom: 'enregistreur.wave', famille: 'audio', type: 'audio/wav', args: [...SON, '-c:a', 'pcm_s16le', '-f', 'wav'] },
  { nom: 'whatsapp.ogg', famille: 'audio', type: 'audio/ogg', args: [...SON, '-c:a', 'libopus', '-b:a', '32k', '-f', 'ogg'] },
  { nom: 'vorbis.oga', famille: 'audio', type: 'audio/ogg', args: [...SON, '-c:a', 'libvorbis', '-f', 'ogg'] },
  { nom: 'iphone.m4a', famille: 'audio', type: 'audio/mp4', args: [...SON, ...AAC, '-f', 'ipod'] },
  { nom: 'livre-audio.m4b', famille: 'audio', type: 'audio/mp4', args: [...SON, ...AAC, '-f', 'ipod'] },
  { nom: 'brut.aac', famille: 'audio', type: 'audio/aac', args: [...SON, ...AAC, '-f', 'adts'] },
  { nom: 'studio.flac', famille: 'audio', type: 'audio/flac', args: [...SON, '-c:a', 'flac', '-f', 'flac'] },
  { nom: 'voix.opus', famille: 'audio', type: 'audio/opus', args: [...SON, '-c:a', 'libopus', '-b:a', '32k', '-f', 'opus'] },
  { nom: 'windows.wma', famille: 'audio', type: 'audio/x-ms-wma', args: [...SON, '-c:a', 'wmav2', '-f', 'asf'] },
  { nom: 'android.3ga', famille: 'audio', type: 'audio/3gpp', args: [...SON, '-c:a', 'aac', '-ar', '22050', '-f', '3gp'] },
  { nom: 'mac.aif', famille: 'audio', type: 'audio/aiff', args: [...SON, '-c:a', 'pcm_s16be', '-f', 'aiff'] },
  { nom: 'mac.aiff', famille: 'audio', type: 'audio/aiff', args: [...SON, '-c:a', 'pcm_s16be', '-f', 'aiff'] },
  { nom: 'iphone.caf', famille: 'audio', type: 'audio/x-caf', args: [...SON, '-c:a', 'alac', '-f', 'caf'] },
  { nom: 'cinema.ac3', famille: 'audio', type: 'audio/ac3', args: [...SON, '-c:a', 'ac3', '-f', 'ac3'] },
  { nom: 'dictaphone.amr', famille: 'audio', type: 'audio/amr', ecrire: amrNb },

  // Images
  { nom: 'photo.jpg', famille: 'image', type: 'image/jpeg', args: [...PHOTO, '-f', 'image2', '-c:v', 'mjpeg'] },
  { nom: 'photo.jpeg', famille: 'image', type: 'image/jpeg', args: [...PHOTO, '-f', 'image2', '-c:v', 'mjpeg'] },
  { nom: 'photo.jfif', famille: 'image', type: 'image/jpeg', args: [...PHOTO, '-f', 'image2', '-c:v', 'mjpeg'] },
  { nom: 'capture.png', famille: 'image', type: 'image/png', args: [...PHOTO, '-f', 'image2', '-c:v', 'png'] },
  { nom: 'web.webp', famille: 'image', type: 'image/webp', args: [...PHOTO, '-f', 'image2', '-c:v', 'libwebp'] },
  { nom: 'anime.gif', famille: 'image', type: 'image/gif', args: [...PHOTO, '-f', 'image2', '-c:v', 'gif'] },
  { nom: 'scan.bmp', famille: 'image', type: 'image/bmp', args: [...PHOTO, '-f', 'image2', '-c:v', 'bmp'] },
  { nom: 'scan.tif', famille: 'image', type: 'image/tiff', args: [...PHOTO, '-f', 'image2', '-c:v', 'tiff'] },
  { nom: 'scan.tiff', famille: 'image', type: 'image/tiff', args: [...PHOTO, '-f', 'image2', '-c:v', 'tiff'] },
  { nom: 'recent.avif', famille: 'image', type: 'image/avif', args: [...PHOTO, '-c:v', 'libaom-av1', '-still-picture', '1', '-cpu-used', '8', '-f', 'avif'] },
  { nom: 'photo-iphone.heic', famille: 'image', type: 'image/heic', fixe: true },
  { nom: 'photo-iphone.heif', famille: 'image', type: 'image/heif', fixe: true },

  // Textes et documents
  { nom: 'script.txt', famille: 'script', type: 'text/plain', ecrire: () => Buffer.from('Lancement : le marché de Mokolo rouvre ce lundi.\nInterview du maire, 45 s.\n') },
  { nom: 'notes.md', famille: 'script', type: 'text/markdown', ecrire: () => Buffer.from('# Sujet\n\n- Qui : le maire\n- Quoi : la réouverture du marché\n') },
  { nom: 'lettre.rtf', famille: 'script', type: 'application/rtf', ecrire: () => Buffer.from('{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Arial;}}\\f0\\fs24 Script du reportage.\\par}') },
  { nom: 'conducteur.pdf', famille: 'script', type: 'application/pdf', ecrire: pdfMinimal },
  { nom: 'script.docx', famille: 'script', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', zip: 'docx' },
  { nom: 'script.odt', famille: 'script', type: 'application/vnd.oasis.opendocument.text', zip: 'odt' },
  { nom: 'ancien.doc', famille: 'script', type: 'application/msword', ecrire: docOle },
  { nom: 'rushes.zip', famille: 'script', type: 'application/zip', zip: 'zip' },
];

/** Deux secondes d'AMR-NB à 12,2 kb/s : l'en-tête, puis 100 trames de 32 octets. */
function amrNb() {
  const trames = [];
  for (let i = 0; i < 100; i += 1) {
    const t = Buffer.alloc(32);
    t[0] = 0x3c; // mode 7 (12,2 kb/s), trame de qualité
    for (let j = 1; j < 32; j += 1) t[j] = (i * 7 + j * 13) & 0xff;
    trames.push(t);
  }
  return Buffer.concat([Buffer.from('#!AMR\n', 'latin1'), ...trames]);
}

function pdfMinimal() {
  const objets = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    null,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  const flux = 'BT /F1 24 Tf 72 760 Td (Conducteur du JT) Tj ET';
  objets[3] = `<< /Length ${flux.length} >>\nstream\n${flux}\nendstream`;
  let corps = '%PDF-1.4\n';
  const positions = [];
  objets.forEach((o, i) => {
    positions.push(corps.length);
    corps += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = corps.length;
  corps += `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n${positions.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('')}`;
  corps += `trailer\n<< /Size ${objets.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(corps, 'latin1');
}

/** L'en-tête OLE d'un vieux .doc Word, suivi de secteurs vides. */
function docOle() {
  const b = Buffer.alloc(4096);
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]).copy(b, 0);
  return b;
}

/** Un zip, un .docx ou un .odt valides, produits par Python (zipfile). */
function ecrireZip(sortie, sorte) {
  const contenus = {
    zip: { 'lisezmoi.txt': 'Rushes du reportage.' },
    docx: {
      '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
      '_rels/.rels': '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
      'word/document.xml': '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Script du reportage</w:t></w:r></w:p></w:body></w:document>',
    },
    odt: {
      mimetype: 'application/vnd.oasis.opendocument.text',
      'content.xml': '<?xml version="1.0" encoding="UTF-8"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" office:version="1.2"><office:body><office:text><text:p>Script du reportage</text:p></office:text></office:body></office:document-content>',
      'META-INF/manifest.xml': '<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/></manifest:manifest>',
    },
  }[sorte];
  const script = [
    'import json, sys, zipfile',
    'contenus = json.loads(sys.argv[2])',
    "with zipfile.ZipFile(sys.argv[1], 'w', zipfile.ZIP_DEFLATED) as z:",
    '    for nom, texte in contenus.items():',
    "        z.writestr(nom, texte, compress_type=zipfile.ZIP_STORED if nom == 'mimetype' else zipfile.ZIP_DEFLATED)",
  ].join('\n');
  const r = spawnSync('python3', ['-I', '-c', script, sortie, JSON.stringify(contenus)]);
  if (r.status !== 0) throw new Error(`zip ${sorte} : ${r.stderr}`);
}

/**
 * Produit (une seule fois, ils sont gardés entre deux passages) tous les
 * fichiers d'essai, et rend la liste des formats avec leur chemin.
 */
export function preparerFichiers() {
  mkdirSync(DOSSIER_FICHIERS, { recursive: true });
  const ffmpeg = trouverFfmpeg();
  return FORMATS.map((f) => {
    const chemin = join(DOSSIER_FICHIERS, f.nom);
    if (!existsSync(chemin) || statSync(chemin).size === 0) {
      if (f.fixe) copyFileSync(join(FIXES, f.nom), chemin);
      else if (f.ecrire) writeFileSync(chemin, f.ecrire());
      else if (f.zip) ecrireZip(chemin, f.zip);
      else {
        const r = spawnSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...f.args, chemin]);
        if (r.status !== 0) throw new Error(`ffmpeg n'a pas su produire ${f.nom} : ${r.stderr}`);
      }
    }
    return { ...f, chemin };
  });
}
