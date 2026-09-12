/**
 * Reconnaissance d'un format sur ses premiers octets, côté navigateur.
 *
 * Jumeau volontaire de `backend/src/lib/signatures.js` : les deux paquets
 * n'ont rien en commun à installer, et dupliquer une table de quelques
 * en-têtes coûte moins cher qu'un paquet partagé à publier. Si l'une bouge,
 * l'autre doit suivre.
 *
 * À quoi ça sert ici : `MediaRecorder` annonce un type qui ne dit pas ce
 * qu'il a enregistré. Safari appelle « audio/aac » un conteneur MP4, et
 * livre parfois un type que personne n'attend. Se fier à cette étiquette
 * faisait nommer l'enregistrement `.webm` par défaut, et le serveur le
 * refusait au motif que ses octets n'étaient pas du Matroska. Le
 * correspondant voyait « Format audio non reconnu » sans aucun recours.
 */

const lit4 = (vue, offset) =>
  String.fromCharCode(vue[offset], vue[offset + 1], vue[offset + 2], vue[offset + 3]);

/** Extension déduite d'un en-tête, ou '' si rien de reconnu. */
export function extensionDepuisOctets(octets) {
  const vue = octets instanceof Uint8Array ? octets : new Uint8Array(octets || []);
  if (vue.length < 12) return '';

  // Conteneur ISO-BMFF : la marque en position 8 sépare mp4, mov et m4a.
  if (lit4(vue, 4) === 'ftyp') {
    const marque = lit4(vue, 8).toLowerCase();
    if (marque.startsWith('qt')) return '.mov';
    if (marque.startsWith('m4a')) return '.m4a';
    if (marque.startsWith('3g')) return '.3gp';
    // Safari enregistre en MP4 ; `.m4a` est le nom d'usage d'un MP4 audio.
    return '.m4a';
  }

  if (vue[0] === 0x1a && vue[1] === 0x45 && vue[2] === 0xdf && vue[3] === 0xa3) {
    const texte = String.fromCharCode(...vue.subarray(0, Math.min(vue.length, 64)));
    return texte.includes('webm') ? '.webm' : '.mkv';
  }

  if (lit4(vue, 0) === 'RIFF' && lit4(vue, 8) === 'WAVE') return '.wav';
  if (lit4(vue, 0) === 'OggS') return '.ogg';
  if (lit4(vue, 0) === 'fLaC') return '.flac';
  if (String.fromCharCode(vue[0], vue[1], vue[2]) === 'ID3') return '.mp3';

  // ADTS (AAC) et MPEG Audio partagent la synchronisation ; ce sont les bits
  // de couche qui les séparent — l'ADTS les met à 00.
  if (vue[0] === 0xff) {
    if ((vue[1] & 0xf6) === 0xf0) return '.aac';
    if ((vue[1] & 0xe0) === 0xe0) return '.mp3';
  }

  return '';
}

/**
 * Extension d'un blob, lue sur son contenu. Le type annoncé ne sert plus que
 * de dernier recours, et l'appel ne peut pas échouer : il renvoie au pire
 * une chaîne vide, à charge de l'appelant de laisser le serveur trancher.
 */
export async function extensionDuBlob(blob, secours = '') {
  try {
    const debut = await blob.slice(0, 64).arrayBuffer();
    const trouvee = extensionDepuisOctets(new Uint8Array(debut));
    if (trouvee) return trouvee;
  } catch {
    // Lecture impossible : on retombe sur le type annoncé.
  }
  return secours;
}

/** Repli sur le type annoncé, quand les octets ne disent rien. */
export function extensionDepuisType(type) {
  const t = String(type || '').toLowerCase();
  if (t.includes('webm')) return '.webm';
  if (t.includes('ogg')) return '.ogg';
  if (t.includes('wav')) return '.wav';
  if (t.includes('mpeg') || t.includes('mp3')) return '.mp3';
  if (t.includes('aac')) return '.aac';
  if (t.includes('mp4')) return '.m4a';
  return '';
}
