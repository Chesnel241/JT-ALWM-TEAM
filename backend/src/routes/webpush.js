import { Router } from 'express';
import webpush from 'web-push';
import logger from '../logger/index.js';
import { getSubscriptions, addSubscription, removeSubscription, AUDIENCES } from '../data/webpushSubscriptions.js';
import { asyncHandler, createErrors } from '../middleware/errorHandler.js';

const router = Router();

// Clés VAPID exclusivement depuis l'environnement. AUCUN fallback en dur :
// une clé privée committée dans le code est compromise (lisible dans
// l'historique git) et permettrait à quiconque de forger des push vers les
// abonnés. Si les clés manquent, le push est simplement désactivé (feature
// non critique) — on ne crashe pas le serveur.
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const pushEnabled = !!(vapidPublicKey && vapidPrivateKey);

if (pushEnabled) {
  webpush.setVapidDetails('mailto:contact@lwm-team.com', vapidPublicKey, vapidPrivateKey);
} else {
  logger.warn('Web Push désactivé : VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY non configurées.');
}

router.get('/vapidPublicKey', (req, res) => {
  if (!pushEnabled) return res.status(503).json({ error: 'Push non configuré' });
  res.json({ publicKey: vapidPublicKey });
});

// Le corps accepte deux formes : l'abonnement nu (anciens clients encore en
// cache) ou { subscription, audience, countryId } qui dit à quelle équipe et
// à quel pays appartient l'appareil. C'est ce contexte qui permet ensuite de
// ne pas réveiller tout le monde à chaque événement.
router.post('/subscribe', asyncHandler(async (req, res, next) => {
  if (!pushEnabled) return res.status(503).json({ error: 'Push non configuré' });
  const body = req.body || {};
  const subscription = body.subscription && body.subscription.endpoint ? body.subscription : body;
  if (!subscription || !subscription.endpoint || typeof subscription.endpoint !== 'string'
      || !subscription.keys || typeof subscription.keys !== 'object'
      || typeof subscription.keys.auth !== 'string' || typeof subscription.keys.p256dh !== 'string') {
    return next(createErrors.badRequest('Invalid subscription object'));
  }

  await addSubscription(subscription, { audience: body.audience, countryId: body.countryId });
  logger.info('New push subscription added', {
    endpoint: subscription.endpoint,
    audience: body.audience || 'unknown',
  });

  res.status(201).json({ success: true });
}));

router.post('/unsubscribe', asyncHandler(async (req, res, next) => {
  const subscription = req.body;
  if (!subscription || !subscription.endpoint) {
    return next(createErrors.badRequest('Invalid subscription object'));
  }
  
  await removeSubscription(subscription.endpoint);
  logger.info('Push subscription removed', { endpoint: subscription.endpoint });
  
  res.status(200).json({ success: true });
}));

/**
 * Envoie une notification aux appareils visés.
 *
 * @param {{title: string, body: string, url: string}} payload
 * @param {{audiences?: string[], countryId?: string}} [filter]
 *   Sans filtre, la notification part à tout le monde : à réserver aux
 *   annonces qui concernent réellement les deux équipes (le JT est prêt).
 */
export const broadcastNotification = async (payload, filter = {}) => {
  if (!pushEnabled) return; // push désactivé faute de clés VAPID
  const entries = getSubscriptions(filter);
  if (entries.length === 0) return;

  const payloadString = JSON.stringify(payload);

  const promises = entries.map(async ({ subscription }) => {
    try {
      await webpush.sendNotification(subscription, payloadString);
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        logger.info('Subscription expired, removing', { endpoint: subscription.endpoint });
        await removeSubscription(subscription.endpoint);
      } else {
        logger.error('Error sending push notification', { error: err.message, endpoint: subscription.endpoint });
      }
    }
  });

  await Promise.all(promises);
};

export { AUDIENCES };

export default router;
