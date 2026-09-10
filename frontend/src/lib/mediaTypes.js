/**
 * Classement des fichiers reçus en quatre familles : vidéo, image, audio,
 * document. Une seule définition partagée par l'espace reportage et l'espace
 * montage, pour qu'un même fichier soit rangé au même endroit des deux côtés.
 *
 * Les listes d'extensions sont volontairement larges : les correspondants
 * envoient depuis des téléphones très variés (HEIC sur iPhone, 3GP et AMR sur
 * des Android d'entrée de gamme, MTS depuis des caméscopes). Un format non
 * reconnu n'est jamais refusé — il atterrit dans « Documents » plutôt que
 * d'être perdu.
 */

const VIDEO_EXT = /\.(mp4|m4v|mov|avi|mkv|webm|mpe?g|mpe|3gp|3g2|wmv|flv|f4v|ts|mts|m2ts|ogv|vob|rm|rmvb|asf|divx)$/i;
const AUDIO_EXT = /\.(mp3|wav|wave|ogg|oga|m4a|m4b|aac|flac|opus|wma|amr|3ga|aif{1,2}|aiff|caf|mid|midi|ape|ac3)$/i;
const IMAGE_EXT = /\.(jpe?g|jfif|png|webp|gif|bmp|tiff?|heic|heif|avif|svg|ico|raw|cr2|nef|arw|dng)$/i;

export const MEDIA_TYPES = Object.freeze({
  VIDEO: 'video',
  IMAGE: 'image',
  AUDIO: 'audio',
  DOCUMENT: 'document',
});

/** Ordre d'affichage des familles, identique partout. */
export const MEDIA_ORDER = Object.freeze([
  MEDIA_TYPES.VIDEO,
  MEDIA_TYPES.IMAGE,
  MEDIA_TYPES.AUDIO,
  MEDIA_TYPES.DOCUMENT,
]);

/**
 * Famille d'un fichier. On regarde d'abord le nom, qui est fiable et présent
 * partout, puis le type déclaré par le serveur en secours. `script` est
 * l'ancien libellé des textes saisis dans la plateforme : il reste rangé
 * dans les documents.
 */
export function classifyFile(file) {
  if (!file) return MEDIA_TYPES.DOCUMENT;

  const name = String(file.name || file.filename || '');
  if (VIDEO_EXT.test(name)) return MEDIA_TYPES.VIDEO;
  if (IMAGE_EXT.test(name)) return MEDIA_TYPES.IMAGE;
  if (AUDIO_EXT.test(name)) return MEDIA_TYPES.AUDIO;

  const declared = String(file.type || '').toLowerCase();
  if (declared.startsWith('video')) return MEDIA_TYPES.VIDEO;
  if (declared.startsWith('image')) return MEDIA_TYPES.IMAGE;
  if (declared.startsWith('audio')) return MEDIA_TYPES.AUDIO;

  return MEDIA_TYPES.DOCUMENT;
}

/** Répartit une liste de fichiers dans les quatre familles. */
export function splitByMediaType(files) {
  const out = {
    [MEDIA_TYPES.VIDEO]: [],
    [MEDIA_TYPES.IMAGE]: [],
    [MEDIA_TYPES.AUDIO]: [],
    [MEDIA_TYPES.DOCUMENT]: [],
  };
  (files || []).forEach((file) => {
    if (!file) return;
    out[classifyFile(file)].push(file);
  });
  return out;
}

// Sections hors reportages numérotés, à afficher après eux.
const TRAILING_SECTIONS = ['annonces', 'séminaires', 'seminaires', 'titres', 'détails', 'details'];

function sectionRank(label, untitledLabel) {
  const value = String(label || '').toLowerCase();
  // Les envois sans section ferment la marche : ce sont des restes, pas une
  // rubrique du JT.
  if (label === untitledLabel) return [3, 0];
  const numbered = value.match(/reportage\s*(\d+)/);
  if (numbered) return [0, Number(numbered[1])];
  const trailing = TRAILING_SECTIONS.findIndex((s) => value.startsWith(s));
  if (trailing >= 0) return [2, trailing];
  return [1, 0];
}

/**
 * Regroupe les fichiers par section d'origine (« Reportage 1 », « Annonces »…)
 * puis, dans chaque section, par famille de média. Les fichiers sans section —
 * envois antérieurs à ce découpage — sont rassemblés à part plutôt qu'éparpillés.
 */
export function groupByReportage(files, { untitledLabel = 'Sans section' } = {}) {
  const groups = new Map();

  (files || []).forEach((file) => {
    if (!file) return;
    const label = (file.reportage || '').trim() || untitledLabel;
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(file);
  });

  return [...groups.entries()]
    .map(([label, list], index) => ({
      label,
      index,
      files: list,
      byType: splitByMediaType(list),
    }))
    .sort((a, b) => {
      const [ra, na] = sectionRank(a.label, untitledLabel);
      const [rb, nb] = sectionRank(b.label, untitledLabel);
      if (ra !== rb) return ra - rb;
      if (na !== nb) return na - nb;
      return a.label.localeCompare(b.label, 'fr');
    })
    .map((group, position) => ({ ...group, index: position }));
}

/**
 * Valeur de l'attribut `accept` des champs de fichiers.
 *
 * Les familles génériques suffisent aux navigateurs modernes, mais plusieurs
 * Android n'associent ni le HEIC ni le 3GP à une famille et masquent alors le
 * fichier dans le sélecteur. On liste donc aussi les extensions.
 */
export const UPLOAD_ACCEPT = [
  'video/*', 'audio/*', 'image/*',
  '.mp4', '.m4v', '.mov', '.avi', '.mkv', '.webm', '.mpg', '.mpeg', '.3gp', '.3g2',
  '.wmv', '.flv', '.ts', '.mts', '.m2ts', '.ogv',
  '.mp3', '.wav', '.ogg', '.oga', '.m4a', '.aac', '.flac', '.opus', '.wma', '.amr', '.3ga', '.aiff', '.caf',
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tif', '.tiff', '.heic', '.heif', '.avif',
  '.txt', '.rtf', '.md', '.doc', '.docx', '.odt', '.pdf', '.zip',
].join(',');
