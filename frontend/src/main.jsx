import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Auto-update du Service Worker, avec la MÊME règle que useVersionCheck : on
// n'applique jamais la nouvelle version tant que l'onglet est au premier plan.
// updateSW(true) recharge la page ; appelé immédiatement, il coupait l'upload
// TUS d'un correspondant ou un montage non encore sauvegardé, exactement ce que
// useVersionCheck s'applique à éviter. On attend donc que l'onglet passe en
// arrière-plan ; si ça n'arrive jamais, la mise à jour prendra au prochain
// chargement (le SW skipWaiting + NetworkFirst sur index.html s'en chargent).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        if (document.hidden) {
          updateSW(true);
          return;
        }
        const applyWhenHidden = () => {
          if (!document.hidden) return;
          document.removeEventListener('visibilitychange', applyWhenHidden);
          updateSW(true);
        };
        document.addEventListener('visibilitychange', applyWhenHidden);
      },
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
