import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';

// Active le nouveau SW immédiatement et prend le contrôle des onglets ouverts
// (évite l'écran blanc post-déploiement : sans ça, le nouveau SW attendrait
// la fermeture de tous les onglets pour s'activer, laissant l'utilisateur
// avec un index.html périmé qui référence des chunks hashés disparus).
self.skipWaiting();
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Précache uniquement les assets statiques (hash immutables). index.html est
// volontairement EXCLU (cf. globPatterns dans vite.config) pour qu'il soit
// toujours récupéré frais depuis le réseau.
precacheAndRoute(self.__WB_MANIFEST || []);

// Navigation (index.html) : NetworkFirst avec fallback cache offline. Sur
// chaque ouverture, on tente le réseau en priorité → l'utilisateur reçoit
// systématiquement la dernière version après un deploy. Si offline, on
// retombe sur la dernière version mise en cache.
registerRoute(
  new NavigationRoute(
    new NetworkFirst({
      cacheName: 'jt-html',
      networkTimeoutSeconds: 15, // Augmenté de 4 à 15 pour les connexions lentes
      plugins: [{
        cacheWillUpdate: async ({ response }) =>
          response && response.status === 200 ? response : null,
      }],
    }),
    {
      denylist: [/^\/api\//, /^\/uploads\//],
    }
  )
);

// Listen for push events
self.addEventListener('push', (event) => {
  let data = { title: 'Nouvelle notification', body: 'Vous avez une nouvelle activité sur JT ALWM.', url: '/' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Clic sur une notification.
//
// Le lien porte désormais l'espace de destination (`/journalistes/...` ou
// `/monteurs/...`). Un onglet déjà ouvert sur une AUTRE page de l'application
// est repris et navigué : ouvrir une seconde fenêtre laissait le correspondant
// avec deux copies de l'app sur son téléphone, et l'ancienne comparaison par
// sous-chaîne ne reconnaissait de toute façon que la page exacte.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data.url || '/';
  const targetUrl = new URL(urlToOpen, self.location.origin);

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const sameOrigin = windowClients.filter((client) => {
        try {
          return new URL(client.url).origin === targetUrl.origin;
        } catch {
          return false;
        }
      });

      const exact = sameOrigin.find((client) => {
        try {
          return new URL(client.url).pathname === targetUrl.pathname;
        } catch {
          return false;
        }
      });
      if (exact && 'focus' in exact) return exact.focus();

      const reusable = sameOrigin[0];
      if (reusable) {
        const focused = 'focus' in reusable ? reusable.focus() : Promise.resolve(reusable);
        return Promise.resolve(focused).then((client) => {
          const target = client || reusable;
          return target && 'navigate' in target ? target.navigate(targetUrl.href) : target;
        });
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl.href);
      }
      return undefined;
    })
  );
});
