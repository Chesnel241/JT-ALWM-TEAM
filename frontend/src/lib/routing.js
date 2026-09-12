/**
 * Routage minimal, sans dépendance : c'est l'URL qui décide de l'espace de
 * travail affiché.
 *
 *   /monteurs/...     → équipe montage. Tous les onglets, accès inchangé.
 *   /journalistes/... → équipe reportage. Uniquement « Espace reportage » et
 *                       « Télécharger le JT ».
 *
 * Les deux équipes partagent le même build et la même API ; seul le périmètre
 * d'interface change. Ce n'est donc PAS une frontière de sécurité : c'est un
 * filtre d'usage pour que les journalistes (souvent peu à l'aise avec l'outil)
 * ne voient que les deux actions qui les concernent.
 *
 * `/` reste l'entrée historique de l'équipe montage — les favoris existants
 * continuent de fonctionner — et est réécrite en `/monteurs` au chargement
 * pour que chaque équipe ait une URL nommée à partager.
 *
 * L'URL porte aussi le PAYS côté journalistes : `/journalistes/ga` ouvre
 * directement l'écran d'envoi du Gabon. C'est le seul support d'identité
 * durable dont on dispose (pas de compte, un mot de passe partagé), et le
 * seul qui survive à un changement de téléphone, à un navigateur privé ou à
 * la purge de stockage que Safari applique après ~7 jours d'inactivité —
 * précisément le rythme d'un JT hebdomadaire. Le lien se transmet par
 * WhatsApp, s'ajoute à l'écran d'accueil, et la mémoire locale ne sert plus
 * que de raccourci de confort.
 */

export const WORKSPACES = Object.freeze({
  EDITOR: 'editor',
  REPORTER: 'reporter',
});

export const WORKSPACE_BASE = Object.freeze({
  [WORKSPACES.EDITOR]: '/monteurs',
  [WORKSPACES.REPORTER]: '/journalistes',
});

// Alias tolérés en entrée : singulier/pluriel et variantes qui circulent déjà
// par WhatsApp. Un lien mal recopié doit ouvrir le bon espace, pas une 404.
const BASE_ALIASES = [
  { workspace: WORKSPACES.REPORTER, prefixes: ['journalistes', 'journaliste', 'reporters', 'reporter', 'reportages'] },
  { workspace: WORKSPACES.EDITOR, prefixes: ['monteurs', 'monteur', 'montage', 'editeurs'] },
];

// [vue, segment d'URL]. Le segment vide est la vue d'accueil de l'espace.
// L'ordre fait foi : le premier segment qui correspond gagne.
const ROUTES = {
  [WORKSPACES.REPORTER]: [
    ['hub', ''],
    ['home', 'reportage'],
    ['uploader', 'reportage/envoi'],
    ['voixoff', 'voix-off'],
    ['delivery', 'telecharger-le-jt'],
  ],
  // L'équipe montage ouvre directement sur son studio : c'est là qu'elle
  // travaille, et c'est l'écran sur lequel elle atterrissait déjà avant que
  // la redirection accidentelle de EditorView soit corrigée.
  [WORKSPACES.EDITOR]: [
    ['dashboard', ''],
    ['home', 'reportages'],
    ['uploader', 'reportage/envoi'],
    ['voixoff', 'voix-off'],
    ['delivery', 'jt-pret'],
    ['planning', 'planning'],
    ['stats', 'stats'],
    ['editor', 'editeur'],
  ],
};

// Segments encore en circulation (favoris, liens partagés) qui ne sont plus
// la forme canonique. Ils ouvrent la bonne vue, puis l'URL est réécrite.
const LEGACY_SEGMENTS = {
  [WORKSPACES.EDITOR]: {
    montage: 'dashboard',
  },
};

// Un identifiant de pays tel que l'API l'accepte : 2 à 12 caractères,
// minuscules, chiffres et tirets. Voir routes/countries.js côté serveur.
const COUNTRY_ID_PATTERN = /^[a-z0-9-]{2,12}$/;

// Segments qui appartiennent au routeur : ils ne peuvent jamais être lus
// comme un identifiant de pays, même s'ils en ont la forme. Les segments
// hérités comptent aussi, sans quoi `/journalistes/montage` deviendrait un
// pays nommé « montage » au lieu de retomber sur l'accueil.
const RESERVED_SEGMENTS = new Set([
  ...Object.values(ROUTES)
    .flat()
    .flatMap(([, segment]) => segment.split('/')),
  ...Object.values(LEGACY_SEGMENTS).flatMap((map) => Object.keys(map)),
].filter(Boolean));

export function isCountrySegment(segment) {
  return (
    typeof segment === 'string' &&
    COUNTRY_ID_PATTERN.test(segment) &&
    !RESERVED_SEGMENTS.has(segment)
  );
}

export const DEFAULT_VIEW = Object.freeze({
  [WORKSPACES.REPORTER]: 'hub',
  [WORKSPACES.EDITOR]: 'dashboard',
});

function routesFor(workspace) {
  return ROUTES[workspace] || ROUTES[WORKSPACES.EDITOR];
}

/** Vues autorisées dans un espace donné (ce qui n'y figure pas n'est pas monté). */
export function viewsForWorkspace(workspace) {
  return routesFor(workspace).map(([view]) => view);
}

export function isViewAllowed(workspace, view) {
  return viewsForWorkspace(workspace).includes(view);
}

export function defaultViewFor(workspace) {
  return DEFAULT_VIEW[workspace] || DEFAULT_VIEW[WORKSPACES.EDITOR];
}

/**
 * URL → { workspace, view, countryId }. Toute URL inconnue retombe sur
 * l'espace montage. `countryId` vaut '' quand l'URL n'en porte pas ; c'est à
 * l'appelant de le confronter à la liste des pays réellement existants.
 */
export function parsePath(pathname, search = '') {
  const segments = String(pathname || '/')
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.toLowerCase());

  const alias = segments.length
    ? BASE_ALIASES.find((entry) => entry.prefixes.includes(segments[0]))
    : null;
  const workspace = alias ? alias.workspace : WORKSPACES.EDITOR;
  const tail = alias ? segments.slice(1) : segments;
  const rest = tail.join('/');
  const queryCountry = countryFromSearch(search);

  const route = routesFor(workspace).find(([, segment]) => segment === rest);
  if (route) return { workspace, view: route[0], countryId: queryCountry };

  const legacy = (LEGACY_SEGMENTS[workspace] || {})[rest];
  if (legacy) return { workspace, view: legacy, countryId: queryCountry };

  // `/journalistes/ga` : le pays vaut itinéraire. C'est le lien personnel
  // qu'un correspondant reçoit une fois par WhatsApp et garde ensuite.
  if (tail.length === 1 && isCountrySegment(tail[0])) {
    return { workspace, view: 'uploader', countryId: tail[0] };
  }

  return { workspace, view: defaultViewFor(workspace), countryId: queryCountry };
}

// `?pays=ga` reste accepté : c'est la forme la plus facile à coller derrière
// une URL existante quand on aide un correspondant au téléphone.
function countryFromSearch(search) {
  const raw = String(search || '');
  if (!raw) return '';
  try {
    const value = new URLSearchParams(raw.startsWith('?') ? raw : `?${raw}`)
      .get('pays');
    const clean = String(value || '').trim().toLowerCase();
    return isCountrySegment(clean) ? clean : '';
  } catch {
    return '';
  }
}

/**
 * { workspace, view } → URL canonique.
 *
 * Côté journalistes, l'écran d'envoi d'un pays connu s'écrit `/journalistes/ga`
 * plutôt que `/journalistes/reportage/envoi` : la barre d'adresse devient le
 * lien personnel du correspondant, donc utilisable tel quel en favori, en
 * raccourci d'écran d'accueil ou recollé dans WhatsApp.
 */
export function buildPath(workspace, view, countryId = '') {
  const base = WORKSPACE_BASE[workspace] || WORKSPACE_BASE[WORKSPACES.EDITOR];
  const clean = String(countryId || '').trim().toLowerCase();

  if (workspace === WORKSPACES.REPORTER && view === 'uploader' && isCountrySegment(clean)) {
    return `${base}/${clean}`;
  }

  const routes = routesFor(workspace);
  const route =
    routes.find(([candidate]) => candidate === view) ||
    routes.find(([candidate]) => candidate === defaultViewFor(workspace));
  const segment = route ? route[1] : '';
  return segment ? `${base}/${segment}` : base;
}
