/**
 * La nouvelle échéance après un délai, telle que le serveur la calculera.
 *
 * Même règle que `repousser()` côté serveur (backend/src/data/store.js) : le
 * délai s'ajoute à l'échéance en vigueur — clôture, délai global, délai déjà
 * accordé au pays — ou à maintenant si elle est passée. Le monteur voit
 * l'heure obtenue AVANT de cliquer, au lieu de la découvrir après.
 */
export function echeanceApresDelai({ cutoffAt, global = null, demande = null, minutes, maintenant = new Date() }) {
  const dates = [
    cutoffAt,
    global?.extendedUntil,
    demande?.status === 'approved' ? demande.extendedUntil : null,
  ]
    .filter(Boolean)
    .map((d) => new Date(d).getTime())
    .filter(Number.isFinite);
  const enVigueur = dates.length ? Math.max(...dates) : 0;
  const base = Math.max(maintenant.getTime(), enVigueur);
  return new Date(base + minutes * 60 * 1000);
}

/** « dim. 14:00 » / « Sun 2:00 PM », dans le fuseau de l'appareil. */
export function heureCourte(date, lang = 'fr', timeZone) {
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'fr-FR', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}
