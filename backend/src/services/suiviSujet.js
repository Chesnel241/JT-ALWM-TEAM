/**
 * Le suivi d'un reportage, tel que le correspondant le voit.
 *
 * LE BESOIN : une fois ses fichiers envoyés, le correspondant ne savait plus
 * rien jusqu'à la publication du JT — et même alors, il devait parcourir
 * trente minutes pour savoir si son reportage y était. Quatre étapes lui
 * disent où il en est : reçu, vu par la rédaction, retenu pour le JT,
 * diffusé (et à quelle minute).
 *
 * Tout se déduit de ce que la rédaction fait déjà — ouvrir un fichier, le
 * valider, poser le reportage au déroulé, publier le JT avec son sommaire.
 * Aucun geste de plus ne lui est demandé.
 *
 * Calcul pur : il se teste seul.
 */

const plusRecent = (dates) => dates.filter(Boolean).sort().at(-1) || null;

/**
 * @param sujet      le sujet (`id`, `etat`, `vuLe`)
 * @param pieces     ses fichiers (`filename`, `status`, `uploadedAt`)
 * @param auDeroule  noms des fichiers présents dans le déroulé enregistré
 * @param livraisons JT publiés de la semaine (`id`, `uploadedAt`, `sommaire`)
 * @returns {{ etape, recuLe, vuLe, diffusion: null | { livraisonId, t, publieLe } }}
 *   `etape` : attendu, recu, vu, valide, aCorriger, retenu, diffuse.
 */
export function suiviDuSujet(sujet, pieces = [], { auDeroule = new Set(), livraisons = [] } = {}) {
  const liste = Array.isArray(pieces) ? pieces.filter(Boolean) : [];
  const recuLe = plusRecent(liste.map((p) => p.uploadedAt));
  const examine = liste.some((p) => p.status === 'approved' || p.status === 'rejected');
  const vuLe = sujet?.vuLe || null;
  const vu = Boolean(vuLe) || examine;
  const aCorriger = liste.some((p) => p.status === 'rejected');
  const valide = sujet?.etat === 'valide' || (liste.length > 0 && liste.every((p) => p.status === 'approved'));
  const retenu = sujet?.etat === 'au_conducteur' || liste.some((p) => auDeroule.has(p.filename));

  // Le JT le plus récent d'abord : c'est celui que le correspondant regardera.
  const publies = (Array.isArray(livraisons) ? livraisons : [])
    .filter((l) => l && l.type === 'video')
    .sort((a, b) => String(b.uploadedAt || '').localeCompare(String(a.uploadedAt || '')));
  let diffusion = null;
  for (const l of publies) {
    const partie = (l.sommaire || []).find((c) => c.sujetId && c.sujetId === sujet?.id);
    if (partie) {
      diffusion = { livraisonId: l.id, t: partie.t, publieLe: l.uploadedAt || null };
      break;
    }
  }
  // Publié sans sommaire (dépôt manuel), mais le reportage était au déroulé :
  // il est dans le JT, sans qu'on sache à quelle minute.
  if (!diffusion && retenu && publies.length > 0) {
    diffusion = { livraisonId: publies[0].id, t: null, publieLe: publies[0].uploadedAt || null };
  }

  let etape = 'attendu';
  if (liste.length > 0) etape = 'recu';
  if (liste.length > 0 && vu) etape = 'vu';
  if (valide) etape = 'valide';
  if (aCorriger) etape = 'aCorriger';
  if (retenu) etape = 'retenu';
  if (diffusion) etape = 'diffuse';

  return { etape, recuLe, vuLe: vuLe || null, diffusion };
}

/**
 * Les reportages d'une semaine qui sont dans un JT publié, par pays : pour
 * prévenir chaque correspondant que SON reportage passe, et à quelle minute.
 *
 * @returns Map(countryId -> [{ sujetId, titre, t }])
 */
export function reportagesDiffuses(livraison, sujets = []) {
  const parId = new Map(sujets.map((s) => [s.id, s]));
  const parPays = new Map();
  for (const c of livraison?.sommaire || []) {
    const sujet = c.sujetId ? parId.get(c.sujetId) : null;
    if (!sujet) continue;
    if (!parPays.has(sujet.countryId)) parPays.set(sujet.countryId, []);
    parPays.get(sujet.countryId).push({ sujetId: sujet.id, titre: sujet.titre, t: c.t });
  }
  return parPays;
}
