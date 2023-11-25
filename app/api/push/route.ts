import { NextResponse, NextRequest } from 'next/server';
// @ts-ignore
import { getSubscriptionsFromDb, saveSubscriptionToDb } from '@/utils/db/in-memory-db';
import webpush, { PushSubscription } from 'web-push';
import { PrismaClient } from '@prisma/client';

webpush.setVapidDetails('mailto:' + process.env.NEXT_PUBLIC_VAPID_EMAIL, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

export async function POST(request: NextRequest) {
    const subscription = (await request.json()) as PushSubscription | null;

    if (!subscription) {
        console.error('No subscription was provided!');
        return;
    }

    const updatedDb = await saveSubscriptionToDb(subscription);

    return NextResponse.json({ message: 'success', updatedDb });
}

export async function GET(_: NextRequest) {
    const subscriptions = await getSubscriptionsFromDb();

    subscriptions.forEach((s) => {
        const payload = JSON.stringify({
            title: 'WebPush Notification!',
            body: 'Hello World',
        });
        webpush
            .sendNotification(s, payload)
            .then((result) => {
                console.log(result);
            })
            .catch((err) => {
                console.error(err);
            });
    });

    return NextResponse.json({
        message: `${subscriptions.length} messages sent!`,
    });
}
