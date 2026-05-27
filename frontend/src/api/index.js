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

  getSubscriptions: (weekId) =>
    request(`/notifications/${weekId}`),

  uploadFile: async (weekId, countryId, file, { onProgress, onPhase, signal, reportage, adminPassword } = {}) => {
    // 1. GET presigned url
    const presignedRes = await request(`/presigned/upload?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}`, {
      method: 'GET',
      adminPassword
    });
    const { url, r2Key, filename } = presignedRes;

    // 2. PUT to Cloudflare using axios
    try {
      await axios.put(url, file, {
        headers: { 'Content-Type': file.type },
        onUploadProgress: (e) => {
          if (e.lengthComputable && typeof onProgress === 'function') {
            onProgress((e.loaded / e.total) * 100);
          }
        },
        signal,
      });
    } catch (err) {
      if (axios.isCancel(err)) throw new Error(tStatic().errors.uploadCancelled);
      throw new Error(tStatic().errors.networkError);
    }
    
    if (typeof onPhase === 'function') onPhase('processing');

    // 3. POST finalize
    let type = 'document';
    if (file.type.startsWith('video/') || file.name.match(/\.(mp4|mov|avi|webm|mkv)$/i)) type = 'video';
    else if (file.type.startsWith('audio/') || file.name.match(/\.(mp3|wav|ogg|m4a)$/i)) type = 'audio';
    else if (file.type.startsWith('image/') || file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)) type = 'image';

    const finalizeRes = await request(`/uploads/${weekId}/${countryId}/finalize${reportage ? `?reportage=${encodeURIComponent(reportage)}` : ''}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: file.name,
        filename: filename,
        size: file.size,
        type: type,
      }),
      adminPassword
    });

    return finalizeRes;
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
    // 1. GET presigned url
    const presignedRes = await request(`/presigned/upload?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}`, {
      method: 'GET'
    });
    const { url, r2Key, filename } = presignedRes;

    // 2. PUT using axios
    try {
      await axios.put(url, file, {
        headers: { 'Content-Type': file.type },
        onUploadProgress: (e) => {
          if (e.lengthComputable && typeof onProgress === 'function') {
            onProgress((e.loaded / e.total) * 100);
          }
        },
        signal,
      });
    } catch (err) {
      if (axios.isCancel(err)) throw new Error(tStatic().errors.uploadCancelled);
      throw new Error(tStatic().errors.networkError);
    }

    if (typeof onPhase === 'function') onPhase('processing');

    // 3. POST finalize
    let type = 'document';
    if (file.type.startsWith('video/') || file.name.match(/\.(mp4|mov|avi|webm|mkv)$/i)) type = 'video';
    else if (file.type.startsWith('audio/') || file.name.match(/\.(mp3|wav|ogg|m4a)$/i)) type = 'audio';
    else if (file.type.startsWith('image/') || file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)) type = 'image';

    const finalizeRes = await request(`/deliveries/${weekId}/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: file.name,
        filename: filename,
        size: file.size,
        type: type,
      })
    });

    return finalizeRes;
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
