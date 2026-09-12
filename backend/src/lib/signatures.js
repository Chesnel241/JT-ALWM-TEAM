/**
 * Reconnaissance d'un format à partir de ses premiers octets.
 *
 * Pourquoi : un correspondant filme avec le téléphone qu'il a, et partage
 * avec l'application qu'il a. Le nom arrive parfois sans extension, le type
 * MIME annoncé vaut très souvent `application/octet-stream`, et Safari
 * appelle « audio/aac » un enregistrement qui est en réalité un conteneur
 * MP4. Ni le nom ni le type déclaré ne sont fiables. Les octets, si.
 *
 * Ce module ne refuse rien : il RECONNAÎT. Il dit « ceci ressemble à du
 * Matroska » ou « je ne sais pas », et c'est à l'appelant de décider. Un
 * « je ne sais pas » ne doit jamais coûter un reportage.
 */

/** Nombre d'octets à lire pour décider. Assez pour marque ISO et DocType. */
export const TAILLE_ENTETE = 64;

const lit4 = (buf, offset) => buf.toString('latin1', offset, offset + 4);
const octets = (buf, ...attendus) => attendus.every((o, i) => buf[i] === o);

/**
 * Conteneur ISO-BMFF : `ftyp` en position 4, puis une « marque » en 8 qui
 * distingue mp4, mov, m4a, heic et 3gp — tous le même conteneur.
 */
function depuisIsoBmff(buf) {
  if (lit4(buf, 4) !== 'ftyp') return '';
  const marque = lit4(buf, 8).toLowerCase();
  if (marque.startsWith('qt')) return '.mov';
  if (marque.startsWith('m4a')) return '.m4a';
  if (marque.startsWith('m4v')) return '.m4v';
  if (marque.startsWith('3g2')) return '.3g2';
  if (marque.startsWith('3g')) return '.3gp';
  if (marque === 'avif' || marque === 'avis') return '.avif';
  if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'heim', 'heis'].includes(marque)) return '.heic';
  // isom, mp41, mp42, iso2, avc1, dash, et tout ce qui viendra : du MP4.
  return '.mp4';
}

/** Matroska et WebM partagent l'en-tête EBML ; le DocType les sépare. */
function depuisEbml(buf) {
  if (!octets(buf, 0x1a, 0x45, 0xdf, 0xa3)) return '';
  return buf.toString('latin1', 0, TAILLE_ENTETE).includes('webm') ? '.webm' : '.mkv';
}

/** RIFF sert de conteneur à trois formats très différents. */
function depuisRiff(buf) {
  if (lit4(buf, 0) !== 'RIFF') return '';
  const type = lit4(buf, 8);
  if (type === 'WAVE') return '.wav';
  if (type === 'AVI ') return '.avi';
  if (type === 'WEBP') return '.webp';
  return '';
}

/**
 * MP3 et AAC commencent tous deux par une synchronisation `1111 1111`.
 * Ce sont les bits de couche qui les séparent : l'ADTS (AAC) les met à 00,
 * que MPEG Audio réserve. Sans cette distinction, un enregistrement AAC
 * passait pour du MP3 et inversement — et la validation de signature
 * refusait l'un comme l'autre.
 */
function depuisSynchroMpeg(buf) {
  if (buf[0] !== 0xff) return '';
  if ((buf[1] & 0xf6) === 0xf0) return '.aac';   // ADTS : F0, F1, F8, F9
  if ((buf[1] & 0xe0) === 0xe0) return '.mp3';   // MPEG 1/2/2.5, couches I à III
  return '';
}

const SIGNATURES_SIMPLES = [
  { ext: '.mp3', test: (b) => b.toString('latin1', 0, 3) === 'ID3' },
  { ext: '.flac', test: (b) => lit4(b, 0) === 'fLaC' },
  { ext: '.amr', test: (b) => octets(b, 0x23, 0x21, 0x41, 0x4d, 0x52) },
  { ext: '.ogg', test: (b) => lit4(b, 0) === 'OggS' },
  { ext: '.jpg', test: (b) => octets(b, 0xff, 0xd8, 0xff) },
  { ext: '.png', test: (b) => octets(b, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a) },
  { ext: '.gif', test: (b) => lit4(b, 0) === 'GIF8' },
  { ext: '.bmp', test: (b) => octets(b, 0x42, 0x4d) },
  { ext: '.tif', test: (b) => octets(b, 0x49, 0x49, 0x2a, 0x00) || octets(b, 0x4d, 0x4d, 0x00, 0x2a) },
  { ext: '.pdf', test: (b) => b.toString('latin1', 0, 5) === '%PDF-' },
  { ext: '.zip', test: (b) => octets(b, 0x50, 0x4b) },
  { ext: '.flv', test: (b) => b.toString('latin1', 0, 3) === 'FLV' },
  { ext: '.asf', test: (b) => octets(b, 0x30, 0x26, 0xb2, 0x75) },
  { ext: '.mpg', test: (b) => octets(b, 0x00, 0x00, 0x01) && (b[3] === 0xba || b[3] === 0xb3) },
  { ext: '.aiff', test: (b) => lit4(b, 0) === 'FORM' },
  { ext: '.caf', test: (b) => lit4(b, 0) === 'caff' },
  // QuickTime sans ftyp : de vrais .mov de caméscopes commencent par l'une
  // de ces boîtes. Les refuser au motif qu'ils n'ont pas de `ftyp` était
  // exactement le genre de faux refus que ce module existe pour supprimer.
  { ext: '.mov', test: (b) => ['moov', 'mdat', 'wide', 'free', 'skip', 'pnot'].includes(lit4(b, 4)) },
  // MPEG-TS : paquets de 188 octets commençant par 0x47. On exige les deux
  // premiers, sinon n'importe quel fichier débutant par un « G » passerait.
  { ext: '.ts', test: (b) => b[0] === 0x47 && (b.length < 189 || b[188] === 0x47) },
];

/**
 * Extension déduite des octets, ou '' si rien de reconnu.
 * @param {Buffer} buf — au moins TAILLE_ENTETE octets si possible
 */
export function extensionDepuisOctets(buf) {
  if (!buf || buf.length < 4) return '';
  return (
    depuisIsoBmff(buf)
    || depuisEbml(buf)
    || depuisRiff(buf)
    || depuisSynchroMpeg(buf)
    || SIGNATURES_SIMPLES.find((s) => { try { return s.test(buf); } catch { return false; } })?.ext
    || ''
  );
}

/**
 * Le contenu est-il du balisage — HTML, SVG, XML — déguisé en média ?
 *
 * C'est la seule divergence entre nom et contenu qui mérite encore un refus.
 * Le reste (un `.wav` qui est en fait du WebP, un `.mp3` qui est de l'AAC)
 * ne blesse personne : le serveur statique fixe le type d'après l'extension
 * et pose `nosniff`, donc le navigateur ne réinterprétera jamais ces octets.
 * Du balisage, en revanche, est la brique d'un XSS stocké s'il venait à être
 * servi en ligne un jour : on ne le laisse pas entrer sous un faux nom.
 */
export function contenuEstBalisage(buf) {
  if (!buf || buf.length < 5) return false;
  const debut = buf.toString('latin1', 0, Math.min(buf.length, TAILLE_ENTETE))
    .replace(/^\uFEFF/, '')
    .trimStart()
    .toLowerCase();
  return debut.startsWith('<!doctype')
    || debut.startsWith('<html')
    || debut.startsWith('<svg')
    || debut.startsWith('<?xml')
    || debut.startsWith('<script');
}

/**
 * Les octets contredisent-ils l'extension annoncée ?
 *
 * Renvoie `null` quand on n'a pas d'avis — c'est fréquent, et ça ne doit
 * jamais servir de motif de refus. `false` signifie « reconnu, et ce n'est
 * pas ce que l'extension prétend ».
 */
export function extensionCoherente(buf, ext) {
  const reconnue = extensionDepuisOctets(buf);
  if (!reconnue) return null;

  const attendue = String(ext || '').toLowerCase();
  if (reconnue === attendue) return true;

  // Familles de conteneurs qui se lisent les unes pour les autres sans que
  // cela pose le moindre problème en aval : ffmpeg et les lecteurs vont au
  // contenu réel, pas au nom.
  const FAMILLES = [
    ['.mp4', '.m4v', '.mov', '.m4a', '.m4b', '.3gp', '.3g2', '.aac', '.heic', '.heif', '.avif'],
    ['.mkv', '.webm'],
    ['.wav', '.wave'],
    ['.jpg', '.jpeg', '.jfif'],
    ['.tif', '.tiff'],
    ['.ogg', '.oga', '.ogv', '.opus'],
    ['.zip', '.docx', '.odt'],
    ['.mpg', '.mpeg', '.mpe', '.ts', '.mts', '.m2ts', '.vob'],
    ['.asf', '.wmv', '.wma'],
    ['.aif', '.aiff'],
  ];
  return FAMILLES.some((f) => f.includes(reconnue) && f.includes(attendue));
}
