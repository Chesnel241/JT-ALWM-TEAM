/**
 * Formate un horodatage ISO en chaîne lisible localisée.
 * - < 1 min : "à l'instant" / "just now"
 * - < 1 heure : "il y a 12 min" / "12 min ago"
 * - < 24 h : "il y a 3 h" / "3 h ago"
 * - sinon : "20 mai 14:32" / "May 20, 2:32 PM"
 */
export function formatRelative(iso, locale = 'fr') {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMs / 3600000);
  const diffD = Math.floor(diffMs / 86400000);

  if (locale === 'en') {
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin} min ago`;
    if (diffH < 24) return `${diffH} h ago`;
    if (diffD < 7) return `${diffD} d ago`;
    return d.toLocaleString('en-US', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  if (diffH < 24) return `il y a ${diffH} h`;
  if (diffD < 7) return `il y a ${diffD} j`;
  return d.toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Date+heure absolue, format court — pour l'attribut `title` au survol.
 */
export function formatAbsolute(iso, locale = 'fr') {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString(locale === 'en' ? 'en-US' : 'fr-FR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
