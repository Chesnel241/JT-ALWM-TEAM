import { useEffect, useState } from 'react';
import { cretes } from './pisteSon.js';

/**
 * La forme d'onde d'un son, calculée dans le navigateur.
 *
 * Pourquoi ici et pas sur le serveur : le fichier est déjà servi au studio
 * pour l'écoute. Le décoder sur place n'ajoute ni route, ni calcul côté
 * serveur, ni surface d'attaque. Un fichier trop lourd n'a simplement pas de
 * forme d'onde : le bloc reste lisible sans elle.
 */
const TAILLE_MAX = 60 * 1024 * 1024;
const COLONNES = 2000;
const CACHE_MAX = 40;
const cache = new Map(); // url -> Promise<{ cretes, duree } | null>

/**
 * À l'échelle de la plus forte crête du fichier : une voix enregistrée
 * doucement restait un trait plat, illisible. La hauteur dit où il y a du son,
 * pas son niveau — le niveau, c'est le master qui le règle (EBU R 128).
 */
export function aLEchelle(valeurs) {
  const max = valeurs.reduce((m, v) => (v > m ? v : m), 0);
  return max > 0 ? valeurs.map((v) => Math.min(1, v / max)) : valeurs;
}

export function chargerFormeOnde(url) {
  if (!url) return Promise.resolve(null);
  if (cache.has(url)) return cache.get(url);
  const Contexte = typeof window !== 'undefined' ? (window.OfflineAudioContext || window.webkitOfflineAudioContext) : null;
  if (!Contexte || typeof fetch !== 'function') return Promise.resolve(null);
  const promesse = (async () => {
    try {
      const reponse = await fetch(url);
      if (!reponse.ok) return null;
      if (Number(reponse.headers.get('content-length')) > TAILLE_MAX) return null;
      const octets = await reponse.arrayBuffer();
      if (octets.byteLength > TAILLE_MAX) return null;
      // 22 050 Hz suffisent pour voir une forme d'onde, et pèsent moitié moins.
      const son = await new Contexte(1, 1, 22050).decodeAudioData(octets);
      return { cretes: aLEchelle(cretes(son.getChannelData(0), COLONNES)), duree: son.duration };
    } catch {
      return null;
    }
  })();
  cache.set(url, promesse);
  // Le plus ancien sort : une semaine de cent voix off ne garde pas tout.
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  return promesse;
}

export function useFormeOnde(url) {
  const [forme, setForme] = useState(null);
  useEffect(() => {
    let vivant = true;
    chargerFormeOnde(url).then((resultat) => { if (vivant) setForme(resultat); });
    return () => { vivant = false; };
  }, [url]);
  return forme;
}

/** Le tracé SVG (abscisses 0..n, ordonnées 0..2) d'une tranche de crêtes. */
export function traceFormeOnde(valeurs) {
  const n = valeurs?.length || 0;
  if (!n) return '';
  const haut = valeurs.map((v, i) => `${i},${(1 - v).toFixed(3)}`);
  const bas = valeurs.map((v, i) => `${n - 1 - i},${(1 + valeurs[n - 1 - i]).toFixed(3)}`);
  return `M${haut.join(' L')} L${bas.join(' L')} Z`;
}
