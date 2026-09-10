import { useEffect, useState } from 'react';

/**
 * Connexion réseau du navigateur.
 *
 * `navigator.onLine` ment dans un sens seulement : il peut annoncer « en
 * ligne » alors que le réseau ne passe pas. L'inverse est fiable, et c'est
 * celui qui nous intéresse : quand il dit « hors ligne », inutile de lancer
 * un envoi voué à échouer sur le forfait du correspondant.
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => (
    typeof navigator === 'undefined' ? true : navigator.onLine !== false
  ));

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return isOnline;
}
