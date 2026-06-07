import { useEffect, useState, useRef } from 'react';

export function useVersionCheck() {
  const [hasNewVersion, setHasNewVersion] = useState(false);
  const currentVersionRef = useRef(null);

  useEffect(() => {
    // Si on est en dev, on ne fait rien
    if (import.meta.env.DEV) return;

    const checkVersion = async () => {
      try {
        // Ajout d'un cache buster pour être sûr d'avoir le vrai fichier
        const res = await fetch(`/version.json?t=${Date.now()}`, {
          cache: 'no-store'
        });
        if (!res.ok) return;
        
        const data = await res.json();
        
        // Initialisation
        if (!currentVersionRef.current) {
          currentVersionRef.current = data.version;
          return;
        }

        // Si la version est différente, on a une mise à jour
        if (data.version && currentVersionRef.current !== data.version) {
          console.log('Nouvelle version détectée !', data.version);
          setHasNewVersion(true);
        }
      } catch (err) {
        console.error('Erreur lors de la vérification de la version:', err);
      }
    };

    // Vérifier au démarrage
    checkVersion();

    // Vérifier toutes les 2 minutes
    const interval = setInterval(checkVersion, 2 * 60 * 1000);

    // Vérifier quand l'onglet redevient actif (ex: l'utilisateur déverrouille son téléphone)
    const onVisibilityChange = () => {
      if (!document.hidden) {
        checkVersion();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const reloadApp = () => {
    // Optionnel : unregister le ServiceWorker pour éviter qu'il serve un vieux cache
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (let registration of registrations) {
          registration.unregister();
        }
        window.location.reload(true);
      });
    } else {
      window.location.reload(true);
    }
  };

  // Si on veut forcer directement sans demander à l'utilisateur :
  // Décommentez ceci pour recharger automatiquement dès la détection
  useEffect(() => {
    if (hasNewVersion) {
      reloadApp();
    }
  }, [hasNewVersion]);

  return { hasNewVersion, reloadApp };
}
