import { env } from "@/lib/env";
import { prisma } from "@/prisma/db";
import "server-only";
import * as webpush from "web-push";

// every push notification of the app goes through here
// (cron.js, CommonJS, has its own copy of sendPush)

webpush.setVapidDetails(
  "mailto:" + env.NEXT_PUBLIC_VAPID_EMAIL,
  env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  env.VAPID_PRIVATE_KEY,
);

type PushSubscription = { endpoint: string; auth: string; p256dh: string };

// 404 Not Found and 410 Gone: the subscription expired or the browser
// unsubscribed, it will never work again (RFC 8030, section 7.3)
export const isExpiredSubscriptionError = (error: unknown) => {
  const statusCode = (error as { statusCode?: unknown } | null)?.statusCode;
  return statusCode === 404 || statusCode === 410;
};

// sends one notification; an expired subscription is deleted (its links to
// the votes too), any other error is only logged: never throws
export const sendPush = async (
  subscription: PushSubscription,
  payload: string,
) => {
  try {
    const res = await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { auth: subscription.auth, p256dh: subscription.p256dh },
      },
      payload,
    );
    console.log("notif envoyée: ", res.statusCode);
  } catch (error) {
    if (!isExpiredSubscriptionError(error)) return console.log(error);

    // deleteMany: no error if another notification deleted it first
    await prisma.subscription
      .deleteMany({ where: { endpoint: subscription.endpoint } })
      .then(() => console.log("abonnement expiré supprimé"))
      .catch((err) => console.log(err));
  }
};
