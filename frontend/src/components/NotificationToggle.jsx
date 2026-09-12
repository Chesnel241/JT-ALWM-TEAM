import { useState, useEffect } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext.jsx';
import { useOptionalToast } from '../hooks/useToast.jsx';

/**
 * Le bouton cloche : recevoir une alerte quand le JT est prêt, ou quand un
 * fichier arrive.
 *
 * Deux corrections importantes par rapport à la version précédente.
 *
 * 1. La clé publique VAPID était écrite en dur ici, alors que le serveur
 *    possède la sienne et l'expose. Si les deux diffèrent — et elles
 *    diffèrent dès qu'on régénère les clés ou qu'on change d'hébergement —
 *    le navigateur s'abonne avec une clé que le serveur ne peut pas signer :
 *    l'abonnement est accepté, la cloche devient bleue, et AUCUNE
 *    notification n'arrive jamais. On lit donc la clé du serveur, et on ne
 *    propose l'abonnement que s'il y en a une.
 *
 * 2. L'appel d'abonnement ignorait la réponse du serveur. Quand le push n'est
 *    pas configuré, il répond 503 : la personne voyait la demande
 *    d'autorisation de son navigateur, acceptait, et croyait être abonnée.
 *    On vérifie la réponse, et on défait l'abonnement local s'il n'a pas été
 *    enregistré — sinon le navigateur garde un abonnement fantôme qui empêche
 *    de réessayer proprement.
 */

// Repli historique, gardé pour les déploiements dont le serveur ne publie pas
// encore sa clé. Ce n'est PAS un secret : la clé publique VAPID est faite pour
// être distribuée aux navigateurs.
const CLE_PUBLIQUE_DEFAUT = 'BDfun-W1NI1jLKY7gwtXtmqwLl7fs1jwlIUjdO8o50vl6k2VbzZppfW4Dc-TxNR1v8sJMfAtUe3k2irQU7y2O7A';

function base64VersOctets(base64) {
  const bourrage = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalise = (base64 + bourrage).replace(/-/g, '+').replace(/_/g, '/');
  const brut = window.atob(normalise);
  const octets = new Uint8Array(brut.length);
  for (let i = 0; i < brut.length; i += 1) octets[i] = brut.charCodeAt(i);
  return octets;
}

/** iPhone : le push n'existe que si la plateforme est sur l'écran d'accueil. */
function estIOSHorsEcranAccueil() {
  if (typeof navigator === 'undefined') return false;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent || '');
  const installee = window.matchMedia?.('(display-mode: standalone)')?.matches
    || window.navigator.standalone === true;
  return ios && !installee;
}

/**
 * `audience` et `countryId` disent au serveur qui est cet appareil. Sans eux,
 * la seule diffusion possible est « tout le monde reçoit tout » : un
 * correspondant était réveillé à chaque dépôt de fichier d'un autre pays.
 */
export default function NotificationToggle({ compact = false, audience = '', countryId = '' }) {
  const { t } = useI18n();
  const { addToast } = useOptionalToast();
  const n = t.notifsPush || {};

  const [abonne, setAbonne] = useState(false);
  const [clePublique, setClePublique] = useState('');
  const [indisponible, setIndisponible] = useState('');
  const [occupe, setOccupe] = useState(true);

  useEffect(() => {
    let vivant = true;

    const preparer = async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        if (vivant) {
          setIndisponible(estIOSHorsEcranAccueil() ? n.nonSupporteIos : n.nonSupporte);
          setOccupe(false);
        }
        return;
      }

      try {
        // La clé du serveur d'abord. 503 = push non configuré côté serveur :
        // inutile de demander une autorisation qui ne mènera nulle part.
        const reponse = await fetch('/api/webpush/vapidPublicKey');
        const cle = reponse.ok ? (await reponse.json())?.publicKey : '';
        if (!vivant) return;
        if (reponse.status === 503) {
          setIndisponible(n.nonConfigure);
          setOccupe(false);
          return;
        }
        setClePublique(cle || CLE_PUBLIQUE_DEFAUT);
      } catch {
        // Serveur injoignable : on garde le repli plutôt que de bloquer la
        // fonction pour un incident réseau passager.
        if (vivant) setClePublique(CLE_PUBLIQUE_DEFAUT);
      }

      try {
        const enregistrement = await navigator.serviceWorker.ready;
        const existant = await enregistrement.pushManager.getSubscription();
        if (vivant) setAbonne(existant !== null);
      } catch {
        // Pas de service worker prêt : l'abonnement reste simplement à faire.
      } finally {
        if (vivant) setOccupe(false);
      }
    };

    preparer();
    return () => { vivant = false; };
    // Les libellés changent avec la langue, pas la disponibilité technique.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const abonner = async () => {
    setOccupe(true);
    let abonnement = null;
    try {
      const enregistrement = await navigator.serviceWorker.ready;
      abonnement = await enregistrement.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64VersOctets(clePublique || CLE_PUBLIQUE_DEFAUT),
      });

      const reponse = await fetch('/api/webpush/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: abonnement, audience, countryId }),
      });

      if (!reponse.ok) {
        // Le serveur n'a pas gardé l'abonnement : le défaire côté navigateur,
        // sinon la cloche resterait allumée pour rien et un nouvel essai
        // retomberait sur l'abonnement fantôme.
        await abonnement.unsubscribe().catch(() => {});
        setIndisponible(reponse.status === 503 ? n.nonConfigure : n.echec);
        addToast(reponse.status === 503 ? n.nonConfigure : n.echec, 'error', 6000);
        return;
      }

      setAbonne(true);
      addToast(n.activeeOk, 'success', 4000);
    } catch (err) {
      if (abonnement) await abonnement.unsubscribe().catch(() => {});
      // Un refus d'autorisation n'est pas une panne : la personne a dit non,
      // ou son navigateur bloque. Les deux se règlent dans les réglages.
      addToast(err?.name === 'NotAllowedError' ? n.bloquees : n.echec, 'error', 7000);
    } finally {
      setOccupe(false);
    }
  };

  const desabonner = async () => {
    setOccupe(true);
    try {
      const enregistrement = await navigator.serviceWorker.ready;
      const abonnement = await enregistrement.pushManager.getSubscription();
      if (abonnement) {
        await fetch('/api/webpush/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(abonnement),
        }).catch(() => {});
        await abonnement.unsubscribe();
      }
      setAbonne(false);
      addToast(n.desactiveeOk, 'info', 3000);
    } catch {
      addToast(n.echec, 'error', 5000);
    } finally {
      setOccupe(false);
    }
  };

  if (indisponible) {
    const court = n.indisponible || 'Notifications indisponibles';
    if (compact) {
      return (
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[color:var(--muted)]"
          title={indisponible}
          aria-label={indisponible}
        >
          <BellOff size={16} aria-hidden="true" />
        </div>
      );
    }
    // Une seule ligne, pas un pavé : ce bloc se pose souvent dans une barre
    // de navigation, où deux lignes de texte décalent tout le reste. Le détail
    // reste accessible au survol.
    return (
      <p
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-xs text-[color:var(--muted)]"
        title={indisponible}
      >
        <BellOff size={14} aria-hidden="true" className="shrink-0" />
        <span className="truncate max-w-[12rem]">{court}</span>
      </p>
    );
  }

  const libelle = abonne ? (n.activees || '') : (n.activer || '');
  const Icone = abonne ? BellRing : Bell;

  return (
    <button
      type="button"
      onClick={abonne ? desabonner : abonner}
      disabled={occupe}
      title={abonne ? (n.desactiver || libelle) : libelle}
      aria-label={abonne ? (n.desactiver || libelle) : libelle}
      aria-pressed={abonne}
      className={`${compact ? 'h-9 w-9 justify-center p-0' : 'px-4 py-2'} text-sm font-semibold rounded-lg transition-[transform,background-color,border-color,color] duration-150 active:scale-[0.97] flex items-center gap-2 disabled:opacity-60 ${
        abonne
          ? 'bg-[var(--accent)] text-white hover:bg-[var(--accent)]/80'
          : 'bg-transparent border border-[var(--border)] text-[color:var(--muted)] hover:text-[color:var(--ink)] hover:border-[var(--muted)]'
      }`}
    >
      {occupe ? (
        <span className="w-4 h-4 rounded-full border-2 border-t-transparent border-current animate-spin" />
      ) : (
        <Icone size={16} aria-hidden="true" />
      )}
      {!compact && libelle}
    </button>
  );
}
