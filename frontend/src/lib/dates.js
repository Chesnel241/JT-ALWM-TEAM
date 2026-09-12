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

/**
 * Nom d'une semaine, tel que la rédaction la nomme.
 *
 * Deux numérotations coexistaient à l'écran : le sélecteur affichait
 * « Semaine 37 » (numéro international, celui qui sert de clé technique) et le
 * planning « Sem. 18 » (numéro de la saison, celui dont l'équipe parle). Même
 * semaine, dix-neuf d'écart, et la question « la 18 ou la 37 ? » à chaque
 * conversation.
 *
 * Le libellé de la rédaction gagne partout où il existe : c'est celui que les
 * gens prononcent. Le numéro international reste le repli, et reste la clé.
 */
export function formatWeekLabel(week, locale = 'fr') {
  const redaction = String(week?.libelle || '').trim();
  if (redaction) return redaction;
  const num = week?.num ?? week?.name?.match(/\d+/)?.[0] ?? '';
  return locale === 'en' ? `Week ${num}` : `Semaine ${num}`;
}

/**
 * La forme complète : le nom, puis les dates. « Sem. 18 · 7 sept. - 13 sept. »
 * C'est la seule forme à utiliser dans un sélecteur ou un en-tête — les dates
 * lèvent l'ambiguïté que le seul numéro laisse entière.
 */
export function formatWeekFull(week, locale = 'fr') {
  const nom = formatWeekLabel(week, locale);
  const dates = formatWeekDates(week, locale);
  return dates ? `${nom} · ${dates}` : nom;
}

/**
 * L'identifiant technique, pour un attribut `title` ou un message de support.
 * Quand quelqu'un signale un problème, c'est cette chaîne qu'on lui demande.
 */
export function formatWeekTechnical(week) {
  return String(week?.id || '');
}

/**
 * Formate la plage de dates d'une semaine dans la bonne locale.
 * Ex: "18 mai - 24 mai" (fr) / "May 18 - May 24" (en)
 */
export function formatWeekDates(week, locale = 'fr') {
  if (!week?.startDate || !week?.endDate) return week?.dates || '';
  const loc = locale === 'en' ? 'en-US' : 'fr-FR';
  const opts = { day: 'numeric', month: 'short' };
  const start = new Date(week.startDate).toLocaleDateString(loc, opts);
  const end = new Date(week.endDate).toLocaleDateString(loc, opts);
  return `${start} - ${end}`;
}

/**
 * Jour d'effacement des rushes d'une semaine, en clair.
 * Ex : « mer. 16 sept. » / « Wed, Sep 16 ».
 *
 * L'interface annonçait « 48 h », ce qui se lit comme une durée de vie de deux
 * jours. La règle réelle est ancrée à la semaine de diffusion : un envoi du
 * lundi vit neuf jours, un envoi du dimanche à l'échéance en vit deux. Une
 * date levée du serveur (`week.expiresAt`) ne peut pas mentir.
 */
export function formatExpiry(week, locale = 'fr') {
  if (!week?.expiresAt) return '';
  const d = new Date(week.expiresAt);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(locale === 'en' ? 'en-US' : 'fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}
