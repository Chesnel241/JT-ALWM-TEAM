/**
 * Les statistiques semaine par semaine, prêtes à montrer.
 *
 * Le serveur envoie un bilan par semaine (backend/src/services/bilanSemaine.js),
 * du plus récent au plus ancien. Ce module en tire les indicateurs, la grille
 * des pays et l'export CSV. Calcul pur, sans React : il se teste seul.
 */

/** Les semaines dans l'ordre de lecture d'un graphique : de gauche (ancienne) à droite. */
export const chronologique = (semaines = []) => [...(Array.isArray(semaines) ? semaines : [])].reverse();

/** La semaine en cours n'est pas finie : ses chiffres ne se comparent pas encore. */
export const estTerminee = (bilan, maintenant = Date.now()) => {
  const cloture = bilan?.cutoffAt ? new Date(bilan.cutoffAt).getTime() : NaN;
  return Number.isFinite(cloture) && cloture <= maintenant;
};

const pct = (n, sur) => (sur > 0 ? Math.round((n / sur) * 100) : null);

/** Le numéro d'une semaine (« 2026-w46 » → 46). */
export const numeroSemaine = (weekId) => Number(/-w(\d{1,2})$/i.exec(String(weekId || ''))?.[1]) || null;

/**
 * Les indicateurs du haut de page : chacun sa valeur pour la dernière semaine
 * terminée, et sa série sur la période (de l'ancienne à la récente), pour la
 * petite courbe de tendance.
 */
export function indicateurs(semaines = [], maintenant = Date.now()) {
  const serie = chronologique(semaines);
  const terminees = serie.filter((b) => estTerminee(b, maintenant));
  const derniere = terminees.at(-1) || serie.at(-1) || null;
  const t = (b) => b?.total || {};
  const valeurs = {
    participation: (b) => pct(t(b).paysActifs, t(b).paysAttendus),
    aLHeure: (b) => pct(t(b).aLHeure, t(b).paysActifs),
    delais: (b) => t(b).delaisDemandes ?? null,
    refus: (b) => t(b).refuses ?? null,
    poids: (b) => t(b).octets ?? null,
    publication: (b) => b?.jt?.apresClotureMin ?? null,
    duree: (b) => b?.jt?.dureeSec ?? null,
    vues: (b) => (b ? (t(b).vues || 0) + (t(b).telechargements || 0) : null),
  };
  const resultat = {};
  for (const [cle, f] of Object.entries(valeurs)) {
    resultat[cle] = {
      valeur: derniere ? f(derniere) : null,
      serie: terminees.map((b) => ({ weekId: b.weekId, valeur: f(b) })),
    };
  }
  resultat.semaine = derniere?.weekId || null;
  resultat.delaisAccordes = derniere ? t(derniere).delaisAccordes ?? 0 : 0;
  resultat.gainOctets = derniere ? t(derniere).gainOctets ?? 0 : 0;
  return resultat;
}

/** La participation de chaque semaine, en trois parts : à l'heure, en retard, rien reçu. */
export function participation(semaines = []) {
  return chronologique(semaines).map((b) => {
    const total = b.total || {};
    const attendus = Math.max(total.paysAttendus || 0, total.paysActifs || 0);
    return {
      weekId: b.weekId,
      numero: numeroSemaine(b.weekId),
      aLHeure: total.aLHeure || 0,
      enRetard: total.enRetard || 0,
      absents: Math.max(0, attendus - (total.paysActifs || 0)),
      attendus,
    };
  });
}

/**
 * La ligne de chaque pays : ses cases semaine par semaine (à l'heure, en
 * retard, rien reçu), et ses totaux sur la période.
 */
export function parPays(semaines = [], paysAttendus = []) {
  const serie = chronologique(semaines);
  const ids = new Set(paysAttendus);
  for (const b of serie) for (const [id, p] of Object.entries(b.pays || {})) if (p.fichiers > 0) ids.add(id);
  return [...ids].map((id) => {
    const cases = serie.map((b) => {
      const p = b.pays?.[id];
      const etat = !p || !p.fichiers ? 'absent' : p.enRetard > 0 ? 'enRetard' : 'aLHeure';
      return { weekId: b.weekId, numero: numeroSemaine(b.weekId), etat, ...(p || {}) };
    });
    const somme = (cle) => cases.reduce((n, c) => n + (Number(c[cle]) || 0), 0);
    const actives = cases.filter((c) => c.etat !== 'absent').length;
    return {
      id,
      cases,
      actives,
      semaines: cases.length,
      aLHeure: cases.filter((c) => c.etat === 'aLHeure').length,
      fichiers: somme('fichiers'),
      refuses: somme('refuses'),
      delais: cases.filter((c) => c.delai).length,
      sujets: somme('sujets'),
      diffuses: somme('diffuses'),
      vues: somme('vues') + somme('telechargements'),
    };
  });
}

/** Les motifs de refus de la période, du plus fréquent au plus rare. */
export function motifsDeLaPeriode(semaines = [], n = 6) {
  const compte = new Map();
  for (const b of semaines) for (const m of b.motifs || []) compte.set(m.texte, (compte.get(m.texte) || 0) + m.n);
  return [...compte.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([texte, total]) => ({ texte, n: total }));
}

/**
 * L'export pour un tableur : une ligne par semaine et par pays. Séparateur
 * « ; » et marque d'ordre des octets : c'est ce qu'Excel en français ouvre
 * correctement d'un double clic.
 */
export function versCSV(semaines = [], nomPays = (id) => id, entetes) {
  const cellule = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    // Une formule glissée dans un nom ne s'exécute pas à l'ouverture.
    const sur = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[";\n\r]/.test(sur) ? `"${sur.replace(/"/g, '""')}"` : sur;
  };
  const lignes = [entetes.map(cellule).join(';')];
  for (const b of chronologique(semaines)) {
    for (const [id, p] of Object.entries(b.pays || {})) {
      lignes.push([
        b.weekId,
        nomPays(id),
        p.fichiers,
        p.enRetard,
        p.refuses,
        p.delai || '',
        p.sujets,
        p.diffuses,
        p.vues,
        p.telechargements,
        Math.round((p.octets || 0) / (1024 * 1024)),
      ].map(cellule).join(';'));
    }
  }
  return `\ufeff${lignes.join('\r\n')}\r\n`;
}
