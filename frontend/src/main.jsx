import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Auto-update du Service Worker : à chaque refresh, dès qu'un nouveau SW est
// détecté (post-deploy), on recharge la page automatiquement. Combiné avec
// skipWaiting/clientsClaim côté SW + NetworkFirst sur index.html, l'utilisateur
// reçoit toujours la dernière version sans avoir à vider le cache manuellement.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() { updateSW(true); },
      onRegisteredSW(_url, reg) {
        // Vérifie une nouvelle version toutes les 60 s tant que l'onglet est
        // ouvert (utile pour les sessions longues sans refresh manuel).
        if (reg) setInterval(() => reg.update().catch(() => {}), 60 * 1000);
      },
    });
  }).catch(() => { /* PWA plugin absent en dev : on ignore */ });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
