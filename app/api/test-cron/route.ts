import { getTime } from '@/lib/utils';
import { prisma } from '@/prisma/db';
import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';
import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';

export const dynamic = 'force-dynamic';

webpush.setVapidDetails('mailto:' + process.env.NEXT_PUBLIC_VAPID_EMAIL, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

export async function GET(_: NextRequest) {
    const todayMidnight = new Date(new Date().toLocaleDateString('en-US', { timeZone: 'Europe/Paris' }));
    const tomorrowMidnight = new Date(todayMidnight.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowMidnightPlusOne = new Date(todayMidnight.getTime() + 2 * 24 * 60 * 60 * 1000);

    const slots = await prisma.slot.findMany({
        where: {
            startDate: {
                gte: tomorrowMidnight,
                lt: tomorrowMidnightPlusOne,
            },
            choices: {
                some: {
                    choice: 3,
                },
            },
        },
        select: {
            startDate: true,
            pollId: true,
            id: true,
            choices: {
                where: {
                    choice: 3,
                },
                select: {
                    vote: {
                        select: {
                            subscriptions: {
                                select: {
                                    auth: true,
                                    endpoint: true,
                                    p256dh: true,
                                },
                            },
                            name: true,
                        },
                    },
                },
            },
        },
    });

    if (slots.length === 0) {
        return NextResponse.json({ message: 'No slots found' });
    }

    // FORMAT TO GET ALL SUBS BY SLOT
    const subscriptionsBySlot: SubscriptionsBySlot = {};
    slots.forEach((slot) => {
        subscriptionsBySlot[slot.id] = {
            pollId: slot.pollId,
            startDate: slot.startDate,
            subscriptions: {},
        };

        slot.choices.forEach((choice) => {
            choice.vote.subscriptions.forEach((subscription) => {
                subscriptionsBySlot[slot.id].subscriptions[subscription.endpoint] = {
                    endpoint: subscription.endpoint,
                    keys: {
                        auth: subscription.auth,
                        p256dh: subscription.p256dh,
                    },
                };
            });
        });
    });

    // SEND NOTIF TO ALL SUBS
    let count = 0;
    Object.values(subscriptionsBySlot).forEach((slot) => {
        const formattedDate = format(slot.startDate, 'eeee d', { locale: fr });
        const body = `Il reste des places disponibles pour le créneau du ${formattedDate} à ${getTime(slot.startDate)} !`;

        const payload = JSON.stringify({
            title: 'Pensez à vous inscrire !',
            body,
            link: `${process.env.DOMAIN}/poll/${slot.pollId}`,
        });
        Object.values(slot.subscriptions).forEach((subscription) => {
            count++;
            webpush
                .sendNotification(subscription, payload)
                .then((res) => console.log(res))
                .catch((err) => console.log(err));
        });
    });

    return NextResponse.json({
        subscriptionsBySlot,
        count: `Sent ${count} notifications`,
    });
}

type SubscriptionsBySlot = {
    [slotId: string]: {
        pollId: string;
        startDate: Date;
        subscriptions: {
            [endpoint: string]: {
                endpoint: string;
                keys: {
                    auth: string;
                    p256dh: string;
                };
            };
        };
    };
};
