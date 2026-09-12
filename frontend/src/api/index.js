import { tStatic } from '../i18n/runtime.js';
import axios from 'axios';
import { readReporterToken } from '../lib/reporterIdentity.js';

export const API_BASE = import.meta.env.VITE_API_URL ?? '';
const BASE = `${API_BASE}/api`;

// Toutes les requêtes envoient le token de session.
async function request(url, options = {}) {
  const headers = { ...options.headers };
  const token = localStorage.getItem('app-password');
  if (token) {
    headers['X-App-Password'] = token;
  }
  if (options.adminPassword) {
    headers['X-Admin-Password'] = options.adminPassword;
  }
  // Lien personnel du correspondant : il attribue un envoi à quelqu'un, il
  // n'ouvre aucune porte. Absent, tout continue de fonctionner.
  const reporterToken = readReporterToken();
  if (reporterToken) {
    headers['X-Reporter-Token'] = reporterToken;
  }

  let res;
  try {
    res = await fetch(`${BASE}${url}`, { ...options, headers });
  } catch (error) {
    throw new Error("Échec de connexion : le serveur redémarre peut-être suite à une mise à jour. Veuillez patienter 30 secondes.");
  }

  if (!res.ok) {
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      const gatewayError = new Error("La plateforme est en cours de mise à jour (redémarrage). Veuillez réessayer dans 30 secondes.");
      gatewayError.status = res.status;
      throw gatewayError;
    }
    const body = await res.json().catch(() => ({ message: res.statusText }));
    // Le statut et le corps sont attachés à l'erreur : certains échecs se
    // rattrapent au lieu de s'afficher (409 TIMELINE_CONFLICT renvoie le
    // workspace à recharger), et un message seul ne permet pas de les
    // distinguer d'une panne réseau.
    const error = new Error(body.message || body.error || tStatic().errors.serverError);
    error.status = res.status;
    error.code = body.code;
    error.body = body;
    throw error;
  }
  
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (e) {
    return text;
  }
}

/**
 * Patience réseau : une dizaine de minutes, par paliers croissants.
 * L'envoi reprend à l'octet près, donc réessayer ne recommence rien.
 */
export const RECHARGES_RESEAU = [
  0, 1000, 2000, 5000, 10000, 20000, 30000, 60000,
  60000, 60000, 60000, 60000, 60000, 60000, 60000, 60000,
];

/**
 * Codes sur lesquels il est inutile d'insister : la réponse ne changera pas
 * en réessayant, et c'est là — et seulement là — qu'un message se justifie.
 * Tout le reste (coupure, 429 d'un limiteur, panne passagère) est réessayé
 * en silence. tus-js-client, par défaut, abandonnait sur TOUT code 4xx : un
 * 429 suffisait donc à perdre un envoi.
 */
export const REFUS_DEFINITIFS = new Set([
  400, // requête malformée
  403, // hors de votre pays
  413, // trop volumineux
  415, // format interdit
  423, // date limite dépassée
]);

export function reessayerSi(err) {
  const statut = err?.originalResponse?.getStatus?.();
  // Pas de réponse du tout : c'est le réseau, donc on réessaie.
  if (!statut) return true;
  return !REFUS_DEFINITIFS.has(statut);
}

/**
 * Taille des morceaux, choisie d'après le lien annoncé par le navigateur.
 * Un morceau perdu est un morceau à refaire : sur une 2G, 5 Mo redemandés
 * après chaque coupure, c'est plusieurs minutes de travail jetées à chaque
 * fois.
 */
export function tailleMorceauParDefaut() {
  const Mo = 1024 * 1024;
  try {
    const lien = globalThis.navigator?.connection?.effectiveType;
    if (lien === 'slow-2g' || lien === '2g') return 1 * Mo;
    if (lien === '3g') return 2 * Mo;
  } catch {
    // API absente (Safari, Firefox) : on garde la valeur nominale.
  }
  return 5 * Mo;
}

// --------------------------------------------------------------------------
// DELAYS & STATS
// --------------------------------------------------------------------------
const delaysApi = {
  async getStats(adminPassword) {
    return request('/delays/stats', { adminPassword });
  },

  async getDelays(weekId) {
    return request(`/delays/${weekId}`);
  },

  async requestDelay(weekId, countryId) {
    return request('/delays/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weekId, countryId })
    });
  },

  async approveDelay(weekId, countryId, minutes, adminPassword) {
    return request('/delays/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      adminPassword,
      body: JSON.stringify({ weekId, countryId, minutes })
    });
  },

  async setGlobalDelay(weekId, minutes, adminPassword) {
    return request('/delays/global', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      adminPassword,
      body: JSON.stringify({ weekId, minutes })
    });
  }
};

export const getClientId = () => {
  try {
    let id = sessionStorage.getItem('jt-client-id');
    if (!id) {
      id = (window.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2));
      sessionStorage.setItem('jt-client-id', id);
    }
    return id;
  } catch {
    return 'client-' + Date.now();
  }
};

export const api = {
  ...delaysApi,
  // === Auth ===
  login: async (password) => {
    const res = await request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res && res.token) {
      localStorage.setItem('app-password', res.token);
    }
    return res;
  },
  logout: async () => {
    localStorage.removeItem('app-password');
    return request('/auth/logout', { method: 'POST' });
  },
  checkAuth: () => {
    // Render free cold start peut prendre 30-50 s. Sans timeout, l'UI reste
    // bloquée sur le skeleton (écran blanc perçu). Avec timeout 12 s on bascule
    // vers la page login (l'utilisateur peut retenter, et le backend chauffe
    // entre-temps).
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    return fetch(`${BASE}/auth/check`, {
      headers: { 'X-App-Password': localStorage.getItem('app-password') || '' },
      signal: ctrl.signal,
    })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => clearTimeout(timer));
  },
  checkAdminPassword: async (adminPassword) => {
    try {
      await request('/auth/check-admin', { headers: { 'X-Admin-Password': adminPassword } });
      return true;
    } catch (err) {
      // Si c'est une vraie erreur (502/503/Network), on la propage pour l'afficher
      if (err.message.includes('mise à jour') || err.message.includes('connexion')) {
        throw err;
      }
      return false;
    }
  },

  // === Métier ===
  getCountries: async () => {
    const countries = await request('/countries');
    return countries.map(c => {
      // Force le code CB pour le Congo Brazzaville même s'il vient d'une DB personnalisée
      if (
        c.id === 'cg' || 
        c.code === 'DAGAN' || 
        c.code === 'CG' || 
        c.name.toLowerCase().includes('congo-brazzaville') || 
        c.name.toLowerCase().includes('congo brazzaville')
      ) {
        return { ...c, code: 'CB' };
      }
      return c;
    });
  },
  createCountry: (country) =>
    request('/countries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(country),
    }),
  getWeeks: () => request('/weeks'),

  // Émet le lien personnel d'un correspondant. Réservé à la rédaction : le
  // lien identifie son porteur.
  createReporterLink: (pays, nom, adminPassword) =>
    request('/liens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      adminPassword,
      body: JSON.stringify({ pays, nom }),
    }),

  // === Sujets ===
  // Un sujet est l'unité de travail : un titre, un auteur, un état. Les
  // fichiers s'y rattachent par `sujetId` au lieu d'une étiquette texte.
  // Sans `countryId`, c'est la semaine entiere : une vue transversale que
  // seule la redaction peut lire (middleware/portee.js cote serveur), d'ou
  // le mot de passe montage.
  getSujets: (weekId, countryId, adminPassword) =>
    request(countryId ? `/sujets/${weekId}/${countryId}` : `/sujets/${weekId}`, { adminPassword }),

  createSujet: (weekId, countryId, titre) =>
    request(`/sujets/${weekId}/${countryId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titre }),
    }),

  renameSujet: (weekId, countryId, sujetId, titre) =>
    request(`/sujets/${weekId}/${countryId}/${sujetId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titre }),
    }),

  setSujetEtat: (weekId, countryId, sujetId, etat, adminPassword) =>
    request(`/sujets/${weekId}/${countryId}/${sujetId}/etat`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      adminPassword,
      body: JSON.stringify({ etat }),
    }),

  deleteSujet: (weekId, countryId, sujetId, adminPassword) =>
    request(`/sujets/${weekId}/${countryId}/${sujetId}`, { method: 'DELETE', adminPassword }),

  getUploads: (weekId, countryId) =>
    request(`/uploads/${weekId}/${countryId}`),

  getDashboard: (weekId, adminPassword) =>
    request(`/uploads/${weekId}`, { adminPassword }),

  getTimelineWorkspace: (weekId, adminPassword) =>
    request(`/editor/timeline/${weekId}`, { adminPassword }),

  saveTimelineWorkspace: (weekId, workspace, adminPassword) =>
    request(`/editor/timeline/${weekId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Client-Id': getClientId() },
      adminPassword,
      body: JSON.stringify(workspace),
    }),

  getWeekActiveJob: (weekId) =>
    request(`/editor/job/${encodeURIComponent(weekId)}`),

  subscribeToNotifications: (weekId, countryId, phone) =>
    request(`/notifications/${weekId}/${countryId}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    }),

  getSubscriptions: (weekId, adminPassword) =>
    request(`/notifications/${weekId}`, { adminPassword }),

  // Jetons de téléchargement : le navigateur ouvre l'URL lui-même et ne peut
  // y joindre aucun en-tête. Le jeton signé (1 h, lié à la ressource) est ce
  // qui prouve le droit sans écrire de secret durable dans l'URL.
  createDownloadToken: (filename, adminPassword) =>
    request('/uploads/download-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      adminPassword,
      body: JSON.stringify({ filename }),
    }),

  createArchiveToken: (weekId, countryId, adminPassword) =>
    request('/uploads/archive-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      adminPassword,
      body: JSON.stringify({ weekId, countryId }),
    }),

  // La voix off passait jusqu'ici par un fetch a la main, qui envoyait le
  // jeton de session dans l'en-tete du mot de passe admin — donc un en-tete
  // toujours faux, et aucun lien personnel. `request` assemble les deux
  // correctement, et c'est ce qui la fait passer la portee.
  uploadVoiceover: (weekId, countryId, formData, adminPassword) =>
    request(`/uploads/voiceover/${weekId}/${countryId}`, {
      method: 'POST',
      body: formData,
      adminPassword,
    }),

  uploadFile: async (weekId, countryId, file, { onProgress, onPhase, signal, reportage, sujetId, adminPassword, tailleMorceau } = {}) => {
    const { Upload } = await import('tus-js-client');
    const token = localStorage.getItem('app-password');

    return new Promise((resolve, reject) => {
      const upload = new Upload(file, {
        endpoint: `${API_BASE}/api/tus/`,
        headers: readReporterToken() ? { 'X-Reporter-Token': readReporterToken() } : {},
        // Cinq tentatives réparties sur 38 secondes, c'était la patience d'un
        // bureau câblé. Un correspondant bascule d'un relais à l'autre, perd
        // le réseau dans un tunnel, ou attend que la 3G revienne : on tient
        // maintenant une dizaine de minutes avant de renoncer. Rien ne
        // s'affiche pendant ce temps, et l'envoi reprend à l'octet près.
        retryDelays: RECHARGES_RESEAU,
        onShouldRetry: reessayerSi,
        chunkSize: tailleMorceau || tailleMorceauParDefaut(),
        // L'empreinte d'un envoi réussi ne sert plus à rien : la garder
        // encombrait le stockage du téléphone semaine après semaine.
        removeFingerprintOnSuccess: true,
        metadata: {
          filename: file.name,
          name: file.name,
          filetype: file.type,
          weekId,
          countryId,
          reportage: reportage || '',
          sujetId: sujetId || '',
          adminPassword: adminPassword || token || '',
          // Repli si un proxy retire l'en-tête X-Reporter-Token posé plus
          // haut : sans identité, un envoi est refusé dès que la portée est
          // en `strict`. Le serveur retire ce champ avant d'écrire les
          // métadonnées sur disque (routes/tus.js).
          reporterToken: readReporterToken() || ''
        },
        onError: function (error) {
          if (upload._aborted) {
            reject(new Error(tStatic().errors.uploadCancelled || 'Upload annulé'));
            return;
          }
          // Le statut voyage avec l'erreur : c'est lui, et non
          // `navigator.onLine`, qui dit si l'envoi est perdu pour de bon ou
          // s'il suffit d'attendre. `definitif` à faux signifie « le réseau
          // a lâché » — on remet en file, sans rien afficher de rouge.
          const statut = error?.originalResponse?.getStatus?.() || 0;
          const echec = new Error(
            statut && error.message ? error.message : (error.message || tStatic().errors.networkError),
          );
          echec.statut = statut;
          echec.definitif = Boolean(statut) && REFUS_DEFINITIFS.has(statut);
          reject(echec);
        },
        onProgress: function (bytesUploaded, bytesTotal) {
          const percentage = (bytesUploaded / bytesTotal) * 100;
          if (typeof onProgress === 'function') {
            onProgress(percentage);
          }
        },
        onSuccess: function () {
          resolve({ success: true, message: 'Upload terminé avec succès via TUS' });
        }
      });

      // Find previous uploads. Le .catch est vital : si findPreviousUploads
      // rejette (localStorage corrompu, fingerprint KO), l'upload ne démarre
      // jamais et la promesse pend pour toujours → on démarre sans reprise.
      upload.findPreviousUploads().then(function (previousUploads) {
        if (previousUploads.length) {
          upload.resumeFromPreviousUpload(previousUploads[0]);
        }
        upload.start();
      }).catch(() => upload.start());

      if (signal) {
        signal.addEventListener('abort', () => {
          upload._aborted = true;
          upload.abort();
        }, { once: true });
      }
    });
  },

  submitScript: (weekId, countryId, content, reportage, sujetId) =>
    request(`/uploads/${weekId}/${countryId}/script`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, reportage, sujetId }),
    }),

  deleteFile: (weekId, countryId, fileId, adminPassword) =>
    request(`/uploads/${weekId}/${countryId}/${fileId}`, { 
      method: 'DELETE',
      adminPassword
    }),

  // === JT Prêt (deliveries) ===
  getDeliveries: (weekId) => request(`/deliveries/${weekId}`),

  uploadDelivery: async (weekId, file, adminPassword, { onProgress, onPhase, signal } = {}) => {
    if (typeof onPhase === 'function') onPhase('processing');
    const formData = new FormData();
    formData.append('file', file);

    const headers = {};
    const token = localStorage.getItem('app-password');
    if (token) headers['X-App-Password'] = token;
    if (adminPassword) headers['X-Admin-Password'] = adminPassword;

    try {
      // Local direct upload for delivery via /api/deliveries/:weekId
      const res = await axios.post(`${API_BASE}/api/deliveries/${weekId}`, formData, {
        headers,
        onUploadProgress: (e) => {
          if (e.lengthComputable && typeof onProgress === 'function') {
            onProgress((e.loaded / e.total) * 100);
          }
        },
        signal,
      });
      return res.data;
    } catch (err) {
      if (axios.isCancel(err)) throw new Error(tStatic().errors.uploadCancelled);
      throw new Error(err.response?.data?.message || tStatic().errors.networkError);
    }
  },

  deleteDelivery: (weekId, fileId, adminPassword) =>
    request(`/deliveries/${weekId}/${fileId}`, { method: 'DELETE', adminPassword }),

  updateFileStatus: (weekId, fileId, status, feedback, adminPassword) =>
    request(`/uploads/${weekId}/files/${fileId}/status`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        ...(adminPassword ? { 'X-Admin-Password': adminPassword } : {})
      },
      body: JSON.stringify({ status, feedback })
    }),

  getAnalytics: (adminPassword) => request('/analytics', { adminPassword }),

  // === Editor / Studio de Montage ===
  editorConcat: (payload, adminPassword) => request('/editor/concat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    adminPassword,
    body: JSON.stringify(payload),
  }),
  editorProgress: (jobId) => request(`/editor/progress/${jobId}`),
  editorResult: (jobId) => request(`/editor/result/${jobId}`),

  // === Themes (écriture/suppression réservées admin) ===
  getThemes: () => request('/themes', { method: 'GET' }),
  saveTheme: (theme, adminPassword) => request('/themes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    adminPassword,
    body: JSON.stringify(theme)
  }),
  deleteTheme: (id, adminPassword) => request(`/themes/${id}`, { method: 'DELETE', adminPassword }),
};
