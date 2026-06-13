import { Router } from 'express';
import webpush from 'web-push';
import logger from '../logger/index.js';
import { getSubscriptions, addSubscription, removeSubscription } from '../data/webpushSubscriptions.js';
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

router.post('/subscribe', asyncHandler(async (req, res, next) => {
  if (!pushEnabled) return res.status(503).json({ error: 'Push non configuré' });
  const subscription = req.body;
  if (!subscription || !subscription.endpoint || typeof subscription.endpoint !== 'string'
      || !subscription.keys || typeof subscription.keys !== 'object'
      || typeof subscription.keys.auth !== 'string' || typeof subscription.keys.p256dh !== 'string') {
    return next(createErrors.badRequest('Invalid subscription object'));
  }
  
  await addSubscription(subscription);
  logger.info('New push subscription added', { endpoint: subscription.endpoint });
  
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

export const broadcastNotification = async (payload) => {
  if (!pushEnabled) return; // push désactivé faute de clés VAPID
  const subscriptions = getSubscriptions();
  if (subscriptions.length === 0) return;
  
  const payloadString = JSON.stringify(payload);
  
  const promises = subscriptions.map(async (subscription) => {
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

export default router;
