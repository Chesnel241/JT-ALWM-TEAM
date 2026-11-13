/**
 * Le bilan d'une semaine : ce que les statistiques montrent, pays par pays.
 *
 * LE BESOIN : les statistiques ne savaient que cumuler (fichiers en retard,
 * délais demandés) depuis toujours, sans dire si cela allait mieux ou moins
 * bien. Et une semaine s'efface du serveur deux jours après sa fin : sans
 * bilan conservé, il n'y avait pas d'historique à montrer.
 *
 * Le bilan se calcule tant que la semaine est là, et il est mis de côté juste
 * avant son effacement (store.js, `cleanupExpiredUploads`). Il ne garde que
 * des nombres, des dates et les premiers mots des motifs de refus : aucun
 * nom de fichier, aucun numéro de téléphone.
 *
 * Calcul pur : il se teste seul.
 */

export const SEMAINES_HISTORIQUE = 12;
export const BILANS_CONSERVES = 26;
const MOTIF_MAX = 80;
const MOTIFS_GARDES = 8;

const UNITES = { octets: 1, o: 1, b: 1, ko: 1024, kb: 1024, mo: 1024 ** 2, mb: 1024 ** 2, go: 1024 ** 3, gb: 1024 ** 3 };

/** « 30.1 MB », « 812 octets », ou un nombre d'octets : toujours des octets. */
export function octetsDe(taille) {
  if (typeof taille === 'number') return Number.isFinite(taille) && taille > 0 ? taille : 0;
  const m = /^\s*([\d.,]+)\s*([a-zA-Zé]+)?\s*$/.exec(String(taille || ''));
  if (!m) return 0;
  const n = Number(m[1].replace(',', '.'));
  const unite = UNITES[String(m[2] || 'octets').toLowerCase()] || 0;
  return Number.isFinite(n) ? Math.round(n * unite) : 0;
}

const plusTot = (dates) => dates.filter(Boolean).sort()[0] || null;

const motifDe = (texte) => String(texte || '').replace(/\s+/g, ' ').trim().slice(0, MOTIF_MAX);

/**
 * @param fichiersParPays { [countryId]: fichiers[] } (sans les tiroirs du JT)
 * @param extensions      `{ global, requests: { [countryId]: { status } } }`
 * @param livraisons      JT publiés (`type`, `uploadedAt`, `dureeSec`, `sommaire`, `vues`)
 * @param sujets          sujets de la semaine (`id`, `countryId`)
 * @param paysAttendus    identifiants des pays qui envoient d'habitude
 */
export function bilanDeSemaine({
  weekId, cutoffAt = null, fichiersParPays = {}, extensions = {}, livraisons = [], sujets = [], paysAttendus = [],
}) {
  const demandes = extensions?.requests || {};
  const diffuses = new Set(livraisons.flatMap((l) => (l.sommaire || []).map((c) => c.sujetId).filter(Boolean)));
  const ids = new Set([...paysAttendus, ...Object.keys(fichiersParPays), ...Object.keys(demandes)]);
  const motifs = new Map();
  const pays = {};
  let gainOctets = 0;

  for (const id of ids) {
    const fichiers = Array.isArray(fichiersParPays[id]) ? fichiersParPays[id].filter(Boolean) : [];
    const refuses = fichiers.filter((f) => f.status === 'rejected');
    for (const f of refuses) {
      const motif = motifDe(f.feedback);
      if (motif) motifs.set(motif, (motifs.get(motif) || 0) + 1);
    }
    for (const f of fichiers) {
      const avant = Number(f.allege?.avant);
      const apres = Number(f.allege?.apres);
      if (avant > apres && apres > 0) gainOctets += avant - apres;
    }
    const demande = demandes[id];
    const sujetsDuPays = sujets.filter((s) => s.countryId === id);
    const vues = livraisons.reduce((n, l) => n + (Number(l.vues?.[id]?.lectures) || 0), 0);
    const telechargements = livraisons.reduce((n, l) => n + (Number(l.vues?.[id]?.telechargements) || 0), 0);
    pays[id] = {
      fichiers: fichiers.length,
      octets: fichiers.reduce((n, f) => n + octetsDe(f.size), 0),
      enRetard: fichiers.filter((f) => f.isLate).length,
      refuses: refuses.length,
      premierEnvoi: plusTot(fichiers.map((f) => f.uploadedAt)),
      sujets: sujetsDuPays.length,
      diffuses: sujetsDuPays.filter((s) => diffuses.has(s.id)).length,
      delai: demande ? (demande.status === 'approved' ? 'accorde' : 'demande') : null,
      vues,
      telechargements,
    };
  }

  const liste = Object.values(pays);
  const actifs = liste.filter((p) => p.fichiers > 0);
  const jt = livraisons
    .filter((l) => l?.type === 'video' && l.uploadedAt)
    .sort((a, b) => String(a.uploadedAt).localeCompare(String(b.uploadedAt)))[0] || null;
  const cloture = cutoffAt ? new Date(cutoffAt).getTime() : NaN;
  const publie = jt ? new Date(jt.uploadedAt).getTime() : NaN;

  return {
    weekId,
    cutoffAt: cutoffAt ? new Date(cutoffAt).toISOString() : null,
    pays,
    motifs: [...motifs.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr'))
      .slice(0, MOTIFS_GARDES)
      .map(([texte, n]) => ({ texte, n })),
    total: {
      paysAttendus: paysAttendus.length,
      paysActifs: actifs.length,
      aLHeure: actifs.filter((p) => p.enRetard === 0).length,
      enRetard: actifs.filter((p) => p.enRetard > 0).length,
      fichiers: liste.reduce((n, p) => n + p.fichiers, 0),
      octets: liste.reduce((n, p) => n + p.octets, 0),
      gainOctets,
      refuses: liste.reduce((n, p) => n + p.refuses, 0),
      delaisDemandes: liste.filter((p) => p.delai).length,
      delaisAccordes: liste.filter((p) => p.delai === 'accorde').length,
      delaiGlobal: Boolean(extensions?.global?.extendedUntil),
      sujets: liste.reduce((n, p) => n + p.sujets, 0),
      diffuses: liste.reduce((n, p) => n + p.diffuses, 0),
      vues: liste.reduce((n, p) => n + p.vues, 0),
      telechargements: liste.reduce((n, p) => n + p.telechargements, 0),
    },
    jt: jt ? {
      publieLe: new Date(publie).toISOString(),
      // Minutes entre la clôture et la publication (négatif : publié avant).
      apresClotureMin: Number.isFinite(cloture) ? Math.round((publie - cloture) / 60000) : null,
      dureeSec: Number.isFinite(Number(jt.dureeSec)) && Number(jt.dureeSec) > 0 ? Math.round(Number(jt.dureeSec)) : null,
    } : null,
  };
}

/**
 * L'historique : les semaines encore là (bilan calculé à neuf) et celles déjà
 * effacées (bilan conservé), de la plus récente à la plus ancienne.
 */
export function historique(vivants = [], conserves = {}, n = SEMAINES_HISTORIQUE) {
  const parSemaine = new Map(Object.entries(conserves || {}));
  for (const b of vivants) parSemaine.set(b.weekId, b);
  return [...parSemaine.values()]
    .filter((b) => b && b.weekId)
    .sort((a, b) => String(b.weekId).localeCompare(String(a.weekId)))
    .slice(0, n);
}
