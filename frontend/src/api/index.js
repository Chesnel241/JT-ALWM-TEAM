import { tStatic } from '../i18n/runtime.js';
import axios from 'axios';

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

  const res = await fetch(`${BASE}${url}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || err.error || tStatic().errors.serverError);
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

export const api = {
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
  checkAdminPassword: (adminPassword) =>
    fetch(`${BASE}/auth/check-admin`, { headers: { 'X-Admin-Password': adminPassword } }).then((r) => r.ok),

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

  getUploads: (weekId, countryId) =>
    request(`/uploads/${weekId}/${countryId}`),

  getDashboard: (weekId) =>
    request(`/uploads/${weekId}`),

  subscribeToNotifications: (weekId, countryId, phone) =>
    request(`/notifications/${weekId}/${countryId}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    }),

  getSubscriptions: (weekId, adminPassword) =>
    request(`/notifications/${weekId}`, { adminPassword }),

  uploadFile: async (weekId, countryId, file, { onProgress, onPhase, signal, reportage, adminPassword } = {}) => {
    const { Upload } = await import('tus-js-client');
    const token = localStorage.getItem('app-password');
    
    return new Promise((resolve, reject) => {
      const upload = new Upload(file, {
        endpoint: `${API_BASE}/api/tus/`,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        metadata: {
          filename: file.name,
          name: file.name,
          filetype: file.type,
          weekId,
          countryId,
          reportage: reportage || '',
          adminPassword: adminPassword || token || ''
        },
        onError: function (error) {
          if (upload._aborted) {
            reject(new Error(tStatic().errors.uploadCancelled || 'Upload annulé'));
          } else {
            reject(new Error(error.message || tStatic().errors.networkError));
          }
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

  submitScript: (weekId, countryId, content, reportage) =>
    request(`/uploads/${weekId}/${countryId}/script`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, reportage }),
    }),

  deleteFile: (weekId, countryId, fileId, adminPassword) =>
    request(`/uploads/${weekId}/${countryId}/${fileId}`, { 
      method: 'DELETE',
      adminPassword
    }),

  // === JT Prêt (deliveries) ===
  getDeliveries: (weekId) => request(`/deliveries/${weekId}`),

  uploadDelivery: async (weekId, file, { onProgress, onPhase, signal } = {}) => {
    if (typeof onPhase === 'function') onPhase('processing');
    const formData = new FormData();
    formData.append('file', file);

    const headers = {};
    const token = localStorage.getItem('app-password');
    if (token) headers['X-App-Password'] = token;

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

  deleteDelivery: (weekId, fileId) =>
    request(`/deliveries/${weekId}/${fileId}`, { method: 'DELETE' }),

  updateFileStatus: (weekId, fileId, status, feedback, adminPassword) =>
    request(`/uploads/${weekId}/files/${fileId}/status`, {
      method: 'PATCH',
      headers: { 
        'Content-Type': 'application/json',
        ...(adminPassword ? { 'X-Admin-Password': adminPassword } : {})
      },
      body: JSON.stringify({ status, feedback })
    }),

  getAnalytics: () => request('/analytics'),

  // === Themes ===
  getThemes: () => request('/themes', { method: 'GET' }),
  saveTheme: (theme) => request('/themes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(theme)
  }),
  deleteTheme: (id) => request(`/themes/${id}`, { method: 'DELETE' }),
};
