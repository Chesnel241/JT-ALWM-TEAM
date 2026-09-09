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

/** URL → { workspace, view }. Toute URL inconnue retombe sur l'espace montage. */
export function parsePath(pathname) {
  const segments = String(pathname || '/')
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.toLowerCase());

  const alias = segments.length
    ? BASE_ALIASES.find((entry) => entry.prefixes.includes(segments[0]))
    : null;
  const workspace = alias ? alias.workspace : WORKSPACES.EDITOR;
  const rest = (alias ? segments.slice(1) : segments).join('/');
  const route = routesFor(workspace).find(([, segment]) => segment === rest);
  if (route) return { workspace, view: route[0] };

  const legacy = (LEGACY_SEGMENTS[workspace] || {})[rest];
  return { workspace, view: legacy || defaultViewFor(workspace) };
}

/** { workspace, view } → URL canonique. */
export function buildPath(workspace, view) {
  const routes = routesFor(workspace);
  const route =
    routes.find(([candidate]) => candidate === view) ||
    routes.find(([candidate]) => candidate === defaultViewFor(workspace));
  const base = WORKSPACE_BASE[workspace] || WORKSPACE_BASE[WORKSPACES.EDITOR];
  const segment = route ? route[1] : '';
  return segment ? `${base}/${segment}` : base;
}
