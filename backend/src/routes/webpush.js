import { Router } from 'express';
import webpush from 'web-push';
import logger from '../logger/index.js';
import { getSubscriptions, addSubscription, removeSubscription } from '../data/webpushSubscriptions.js';
import { asyncHandler, createErrors } from '../middleware/errorHandler.js';

const router = Router();

// Allow fallback for local testing, but these should be overriden by .env
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || 'BDfun-W1NI1jLKY7gwtXtmqwLl7fs1jwlIUjdO8o50vl6k2VbzZppfW4Dc-TxNR1v8sJMfAtUe3k2irQU7y2O7A';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || 'jV-16uuCRd90Fe6hgwHsMdl7d6btbkSOI97a4RmvBXM';

webpush.setVapidDetails(
  'mailto:contact@lwm-team.com',
  vapidPublicKey,
  vapidPrivateKey
);

router.get('/vapidPublicKey', (req, res) => {
  res.json({ publicKey: vapidPublicKey });
});

router.post('/subscribe', asyncHandler(async (req, res, next) => {
  const subscription = req.body;
  if (!subscription || !subscription.endpoint) {
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
