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
      networkTimeoutSeconds: 4,
      plugins: [{
        cacheWillUpdate: async ({ response }) =>
          response && response.status === 200 ? response : null,
      }],
    })
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

// Handle click on notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
