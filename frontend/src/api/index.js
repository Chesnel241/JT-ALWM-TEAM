import { tStatic } from '../i18n/runtime.js';

export const API_BASE = import.meta.env.VITE_API_URL ?? '';
const BASE = `${API_BASE}/api`;

async function request(url, options = {}) {
  const pwd = localStorage.getItem('app-password') || '';
  const headers = { ...options.headers };
  if (pwd) headers['X-App-Password'] = pwd;

  const res = await fetch(`${BASE}${url}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    // Préférer `message` (publicMessage user-friendly) à `error`
    // (générique 'Internal server error' en prod).
    throw new Error(err.message || err.error || tStatic().errors.serverError);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  getCountries: () => request('/countries'),
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

  // Utilise XMLHttpRequest plutôt que fetch pour exposer la progression
  // réelle d'upload (fetch n'a pas d'événement progress sur les requêtes).
  uploadFile: (weekId, countryId, file, { onProgress, signal, reportage } = {}) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const url = `${BASE}/uploads/${weekId}/${countryId}${reportage ? `?reportage=${encodeURIComponent(reportage)}` : ''}`;
      xhr.open('POST', url);

      const pwd = localStorage.getItem('app-password');
      if (pwd) xhr.setRequestHeader('X-App-Password', pwd);

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
          reject(new Error((body && body.message) || xhr.statusText || tStatic().errors.serverError));
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

  deleteFile: (weekId, countryId, fileId) =>
    request(`/uploads/${weekId}/${countryId}/${fileId}`, { method: 'DELETE' }),

  // === JT Prêt (deliveries) ===
  getDeliveries: (weekId) => request(`/deliveries/${weekId}`),

  uploadDelivery: (weekId, file, { onProgress, signal } = {}) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${BASE}/deliveries/${weekId}`);

      const pwd = localStorage.getItem('app-password');
      if (pwd) xhr.setRequestHeader('X-App-Password', pwd);

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

  updateFileStatus: (weekId, fileId, status, feedback = '') =>
    request(`/uploads/${weekId}/files/${fileId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, feedback }),
    }),

  getAnalytics: () => request('/analytics'),
};
