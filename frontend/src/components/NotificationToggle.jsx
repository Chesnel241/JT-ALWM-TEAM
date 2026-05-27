import React, { useState, useEffect } from 'react';

// Assurez-vous d'utiliser la clé publique VAPID correcte
const publicVapidKey = 'BDfun-W1NI1jLKY7gwtXtmqwLl7fs1jwlIUjdO8o50vl6k2VbzZppfW4Dc-TxNR1v8sJMfAtUe3k2irQU7y2O7A';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function NotificationToggle() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      navigator.serviceWorker.ready.then((registration) => {
        registration.pushManager.getSubscription().then((subscription) => {
          setIsSubscribed(subscription !== null);
          setLoading(false);
        });
      });
    } else {
      setLoading(false);
    }
  }, []);

  const subscribeUser = async () => {
    try {
      setLoading(true);
      const registration = await navigator.serviceWorker.ready;
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
      });

      await fetch('/api/webpush/subscribe', {
        method: 'POST',
        body: JSON.stringify(subscription),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      setIsSubscribed(true);
    } catch (err) {
      console.error('Failed to subscribe the user: ', err);
      if (err.name === 'NotAllowedError') {
        alert('Les notifications sont bloquées. Veuillez les autoriser dans les paramètres de votre navigateur/téléphone.');
      } else {
        alert("Erreur lors de l'activation des notifications: " + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const unsubscribeUser = async () => {
    try {
      setLoading(true);
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await fetch('/api/webpush/unsubscribe', {
          method: 'POST',
          body: JSON.stringify(subscription),
          headers: {
            'Content-Type': 'application/json'
          }
        });
        await subscription.unsubscribe();
        setIsSubscribed(false);
      }
    } catch (err) {
      console.error('Failed to unsubscribe the user: ', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isSupported) {
    return (
      <div className="text-xs text-red-500 opacity-80 px-4 py-2 border border-red-500/20 rounded bg-red-500/10">
        Notifications Push non supportées. (Sur iOS, ajoutez l'app à l'écran d'accueil).
      </div>
    );
  }

  return (
    <button
      onClick={isSubscribed ? unsubscribeUser : subscribeUser}
      disabled={loading}
      className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 ${
        isSubscribed 
          ? 'bg-[var(--accent)] text-white hover:bg-[var(--accent)]/80' 
          : 'bg-transparent border border-[var(--border)] text-[color:var(--muted)] hover:text-white hover:border-[var(--muted)]'
      }`}
    >
      {loading ? (
        <span className="w-4 h-4 rounded-full border-2 border-t-transparent border-current animate-spin"></span>
      ) : (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isSubscribed ? "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" : "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"} />
        </svg>
      )}
      {isSubscribed ? 'Notifications Activées' : 'Activer Notifications'}
    </button>
  );
}
