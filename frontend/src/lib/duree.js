/**
 * Mise en forme des durées de rushes.
 *
 * Le serveur mesure chaque fichier à l'arrivée et range un nombre de
 * secondes. Les écrans l'affichent tel qu'un monteur le lit à voix haute :
 * « 1 min 42 », jamais « 102 s » ni « 00:01:42 ».
 *
 * `null` est un cas normal et fréquent : une photo n'a pas de durée, un
 * conteneur illisible non plus. On le dit, on ne l'invente pas.
 */

/** Secondes → « 42 s », « 1 min 42 », « 1 h 04 min ». `null` si inconnue. */
export function formaterDuree(secondes) {
  const n = Number(secondes);
  if (!Number.isFinite(n) || n <= 0) return null;

  const total = Math.round(n);
  const heures = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const reste = total % 60;

  if (heures > 0) return `${heures} h ${String(minutes).padStart(2, '0')} min`;
  if (minutes > 0) return `${minutes} min ${String(reste).padStart(2, '0')}`;
  return `${reste} s`;
}

/**
 * Somme des durées connues d'une liste de fichiers.
 *
 * Rend `{ secondes, connus, inconnus }` : le total ne vaut que s'il est lu
 * avec le nombre de fichiers qu'il ignore. Annoncer « 8 min » sans dire que
 * trois rushes n'ont pas pu être mesurés serait un chiffre faux.
 */
export function totaliserDurees(fichiers = []) {
  let secondes = 0;
  let connus = 0;
  let inconnus = 0;

  for (const f of Array.isArray(fichiers) ? fichiers : []) {
    // Seuls les médias portent une durée ; un script n'en a pas et ne
    // compte donc pas comme « non mesuré ».
    if (!f || (f.type !== 'video' && f.type !== 'audio')) continue;
    const n = Number(f.duree);
    if (Number.isFinite(n) && n > 0) {
      secondes += n;
      connus += 1;
    } else {
      inconnus += 1;
    }
  }

  return { secondes, connus, inconnus };
}

/** Le total d'une liste, déjà mis en forme. `null` si rien n'est mesurable. */
export function formaterTotal(fichiers = []) {
  const { secondes } = totaliserDurees(fichiers);
  return formaterDuree(secondes);
}
