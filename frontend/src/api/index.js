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

  uploadFile: (weekId, countryId, file) => {
    const form = new FormData();
    form.append('file', file);
    return request(`/uploads/${weekId}/${countryId}`, { method: 'POST', body: form });
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
