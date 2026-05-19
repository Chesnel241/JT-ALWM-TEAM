export const API_BASE = import.meta.env.VITE_API_URL ?? '';
const BASE = `${API_BASE}/api`;

async function request(url, options = {}) {
  const res = await fetch(`${BASE}${url}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Erreur serveur');
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  getCountries: () => request('/countries'),
  getWeeks: () => request('/weeks'),

  getUploads: (weekId, countryId) =>
    request(`/uploads/${weekId}/${countryId}`),

  getDashboard: (weekId) =>
    request(`/uploads/${weekId}`),

  // Utilise XMLHttpRequest plutôt que fetch pour exposer la progression
  // réelle d'upload (fetch n'a pas d'événement progress sur les requêtes).
  uploadFile: (weekId, countryId, file, { onProgress, signal } = {}) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${BASE}/uploads/${weekId}/${countryId}`);

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
          reject(new Error((body && body.message) || xhr.statusText || 'Erreur serveur'));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Erreur réseau')));
      xhr.addEventListener('abort', () => reject(new Error('Upload annulé')));

      if (signal) {
        signal.addEventListener('abort', () => xhr.abort(), { once: true });
      }

      const form = new FormData();
      form.append('file', file);
      xhr.send(form);
    });
  },

  submitScript: (weekId, countryId, content) =>
    request(`/uploads/${weekId}/${countryId}/script`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    }),

  deleteFile: (weekId, countryId, fileId) =>
    request(`/uploads/${weekId}/${countryId}/${fileId}`, { method: 'DELETE' }),
};
