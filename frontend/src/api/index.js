import { tStatic } from '../i18n/runtime.js';

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
  return res.status === 204 ? null : res.json();
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
  checkAuth: () =>
    fetch(`${BASE}/auth/check`, { headers: { 'X-App-Password': localStorage.getItem('app-password') || '' } }).then((r) => r.ok),

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

  getSubscriptions: (weekId) =>
    request(`/notifications/${weekId}`),

  // XMLHttpRequest pour exposer la progression d'upload (fetch n'a pas
  // d'événement progress sur les requêtes en envoi).
  uploadFile: (weekId, countryId, file, { onProgress, signal, reportage } = {}) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const url = `${BASE}/uploads/${weekId}/${countryId}${reportage ? `?reportage=${encodeURIComponent(reportage)}` : ''}`;
      xhr.open('POST', url);
      
      const token = localStorage.getItem('app-password');
      if (token) {
        xhr.setRequestHeader('X-App-Password', token);
      }

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && typeof onProgress === 'function') {
          onProgress((e.loaded / e.total) * 100);
        }
      });

      xhr.addEventListener('load', () => {
        let body = null;
        try { body = xhr.responseText ? JSON.parse(xhr.responseText) : null; } catch { /* ignore */ }
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(body);
        } else {
          reject(new Error((body && body.message) || (body && body.error) || xhr.statusText || tStatic().errors.serverError));
        }
      });

      xhr.addEventListener('error', () => reject(new Error(tStatic().errors.networkError)));
      xhr.addEventListener('abort', () => reject(new Error(tStatic().errors.uploadCancelled)));

      if (signal) {
        signal.addEventListener('abort', () => xhr.abort(), { once: true });
      }

      const form = new FormData();
      form.append('file', file);
      xhr.send(form);
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

  uploadDelivery: (weekId, file, { onProgress, signal } = {}) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${BASE}/deliveries/${weekId}`);
      
      const token = localStorage.getItem('app-password');
      if (token) {
        xhr.setRequestHeader('X-App-Password', token);
      }
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && typeof onProgress === 'function') {
          onProgress((e.loaded / e.total) * 100);
        }
      });
      xhr.addEventListener('load', () => {
        let body = null;
        try { body = xhr.responseText ? JSON.parse(xhr.responseText) : null; } catch { /* ignore */ }
        if (xhr.status >= 200 && xhr.status < 300) resolve(body);
        else reject(new Error((body && body.message) || (body && body.error) || xhr.statusText || tStatic().errors.serverError));
      });
      xhr.addEventListener('error', () => reject(new Error(tStatic().errors.networkError)));
      xhr.addEventListener('abort', () => reject(new Error(tStatic().errors.uploadCancelled)));
      if (signal) signal.addEventListener('abort', () => xhr.abort(), { once: true });
      const form = new FormData();
      form.append('file', file);
      xhr.send(form);
    });
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
};
