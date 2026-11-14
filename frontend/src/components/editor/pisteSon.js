/**
 * La piste son dans le studio : poser, déplacer, rogner un son à l'œil.
 *
 * Les règles communes (champs, bornes, baisse sous la voix) vivent dans
 * `remotion/src/pisteAudio.js`, lu aussi par le serveur et le moteur. Ici, le
 * seul calcul des gestes, sans React : il se teste seul.
 */
import { MIN_CLIP_DURATION, roundToFrame } from './timelineModel.js';
import { dureeSon, nettoyerPisteAudio, nomDeFichierSur } from '../../../../remotion/src/pisteAudio.js';

const borner = (v, min, max) => Math.min(Math.max(v, min), Math.max(min, max));
const sansAccent = (texte) => String(texte || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** La place d'un son sur la timeline, et ce que sa source permet encore. */
export function placeSon(son) {
  const debut = Number(son?.startTime) || 0;
  const duree = dureeSon(son);
  const inPoint = Number(son?.inPoint) || 0;
  const source = Number(son?.sourceDurationSec) > 0
    ? Number(son.sourceDurationSec)
    : inPoint + duree;
  return { debut, duree, inPoint, source };
}

/**
 * La nouvelle place d'un son après un glissé de `delta` secondes.
 * `move` déplace le son, `left` et `right` le rognent sans dépasser sa source.
 * Rend les champs à écrire : `startTime`, `inPoint`, `outPoint`.
 */
export function nouvellePlaceSon({ debut, duree, inPoint, source }, mode, delta, accrocher = (x) => x) {
  const fin = debut + duree;
  if (mode === 'move') {
    const vise = accrocher(roundToFrame(debut + delta));
    return { startTime: roundToFrame(Math.max(0, vise)), inPoint, outPoint: roundToFrame(inPoint + duree) };
  }
  if (mode === 'left') {
    const vise = accrocher(roundToFrame(debut + delta));
    // On peut rallonger vers l'avant jusqu'au début du fichier, jamais au-delà.
    const nouveauDebut = roundToFrame(borner(vise, Math.max(0, debut - inPoint), fin - MIN_CLIP_DURATION));
    return {
      startTime: nouveauDebut,
      inPoint: roundToFrame(inPoint + (nouveauDebut - debut)),
      outPoint: roundToFrame(inPoint + duree),
    };
  }
  const vise = accrocher(roundToFrame(fin + delta));
  const nouvelleFin = roundToFrame(borner(vise, debut + MIN_CLIP_DURATION, debut + (source - inPoint)));
  return { startTime: debut, inPoint, outPoint: roundToFrame(inPoint + (nouvelleFin - debut)) };
}

/** Écrit des champs sur le son `id`, sans toucher aux autres. */
export function ecrireSon(audio, id, champs) {
  let change = false;
  const suite = (audio || []).map((son) => {
    if (son.id !== id) return son;
    change = true;
    return { ...son, ...champs };
  });
  return change ? suite : audio;
}

/** Retire le son `id` de la piste. */
export function retirerSon(audio, id) {
  const suite = (audio || []).filter((son) => son.id !== id);
  return suite.length === (audio || []).length ? audio : suite;
}

/**
 * Ce qu'est probablement un fichier audio : une voix off, sauf si son nom dit
 * autre chose. Les correspondants envoient surtout des voix off.
 */
export function roleDevine(fichier) {
  const nom = sansAccent(`${fichier?.name || ''} ${fichier?.filename || ''} ${fichier?.reportage || ''}`);
  if (/musique|music|instru|jingle|fond sonore/.test(nom)) return 'musique';
  if (/ambiance|bruitage|son d|sfx/.test(nom)) return 'son';
  return 'voix';
}

/** Un nouveau son posé à `instant`, nettoyé comme il le sera au serveur. */
export function nouveauSon(fichier, { id, instant = 0, duree = null, role = null } = {}) {
  if (!nomDeFichierSur(fichier?.filename)) return null;
  const [son] = nettoyerPisteAudio([{
    id,
    filename: fichier.filename,
    proxyFilename: fichier.proxyFilename,
    name: fichier.name || fichier.filename,
    role: role || roleDevine(fichier),
    startTime: roundToFrame(Math.max(0, Number(instant) || 0)),
    inPoint: 0,
    outPoint: null,
    sourceDurationSec: Number(duree) > 0 ? Number(duree) : null,
    volume: 1,
  }]);
  return son || null;
}

/**
 * L'ancienne voix off unique devient un son de la piste.
 *
 * Elle se réglait dans « Habillage du JT », par une heure tapée en secondes.
 * Un montage qui en avait une la retrouve sur la piste son, au même endroit et
 * au même volume ; l'ancien réglage est éteint pour ne pas la jouer deux fois.
 */
export function migrerVoixOff(branding, audio) {
  const vo = branding?.voiceover;
  if ((audio || []).length > 0 || !vo?.enabled || !nomDeFichierSur(vo.filename)) return { branding, audio: audio || [] };
  const son = nouveauSon({ filename: vo.filename, name: vo.name || vo.filename }, { id: 'voix-off-1', instant: vo.startTime, role: 'voix' });
  if (!son) return { branding, audio: audio || [] };
  son.volume = Math.min(1, Math.max(0, Number(vo.volume ?? 1)));
  return { branding: { ...branding, voiceover: { ...vo, enabled: false } }, audio: [son] };
}

/**
 * Les crêtes d'un signal, en `n` colonnes de 0 à 1 : de quoi dessiner une
 * forme d'onde lisible sans garder le son entier en mémoire.
 */
export function cretes(donnees, n) {
  const total = donnees?.length || 0;
  const colonnes = Math.max(1, Math.floor(n));
  const sortie = new Array(colonnes).fill(0);
  if (!total) return sortie;
  const pas = total / colonnes;
  for (let c = 0; c < colonnes; c += 1) {
    const debut = Math.floor(c * pas);
    const fin = Math.max(debut + 1, Math.floor((c + 1) * pas));
    let max = 0;
    // Un échantillon sur huit suffit à voir la crête, et va huit fois plus vite.
    for (let i = debut; i < fin && i < total; i += 8) {
      const v = Math.abs(donnees[i]);
      if (v > max) max = v;
    }
    sortie[c] = Math.min(1, max);
  }
  return sortie;
}
