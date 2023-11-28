import { prisma } from '@/prisma/db';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';

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
            startTime: true,
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
            startTime: slot.startTime,
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
    Object.entries(subscriptionsBySlot).forEach(([slotId, slot]) => {
        const formattedDate = format(slot.startDate, 'eeee d', { locale: fr });
        const body = `Il reste des places disponibles pour le créneau du ${formattedDate} à ${slot.startTime} !`;

        const payload = JSON.stringify({
            title: 'Pensez à vous inscrire !',
            body,
        });
        Object.values(slot.subscriptions).forEach((subscription) => {
            webpush
                .sendNotification(subscription, payload)
                .then((result) => {
                    console.log(result);
                })
                .catch((err) => {
                    console.log(err);
                });
        });
    });

    return NextResponse.json(slots);
}

type SubscriptionsBySlot = {
    [slotId: string]: {
        pollId: string;
        startDate: Date;
        startTime: string;
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
