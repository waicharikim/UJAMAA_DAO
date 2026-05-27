import webpush from 'web-push';
import { prisma } from '../../../core/database/client.js';

const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY  ?? '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? '';
const VAPID_SUBJECT     = process.env.VAPID_SUBJECT     ?? 'mailto:admin@ujamaadao.org';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export const pushService = {
  getPublicKey(): string {
    return VAPID_PUBLIC_KEY;
  },

  async subscribe(
    userId: string,
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    userAgent?: string
  ) {
    return prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, userAgent },
      create: {
        userId,
        endpoint: subscription.endpoint,
        p256dh:   subscription.keys.p256dh,
        auth:     subscription.keys.auth,
        userAgent,
      },
    });
  },

  async unsubscribe(userId: string, endpoint: string) {
    await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  },

  async sendToUser(
    userId: string,
    payload: { title: string; body: string; url?: string; icon?: string }
  ) {
    const subs = await prisma.pushSubscription.findMany({ where: { userId } });
    const results = await Promise.allSettled(
      subs.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        )
      )
    );

    // Remove stale subscriptions (410 Gone)
    const stale: string[] = [];
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        const err = r.reason as { statusCode?: number };
        if (err?.statusCode === 410) stale.push(subs[i].endpoint);
      }
    });
    if (stale.length) {
      await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: stale } } });
    }
  },
};
