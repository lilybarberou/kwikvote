import { prisma } from '@/prisma/db';
import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

webpush.setVapidDetails('mailto:' + process.env.NEXT_PUBLIC_VAPID_EMAIL, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
// CREATE COMMENT
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const data = bodySchema.parse(body);
        const comment = await prisma.comment.create({ data: data.comment });

        // SEND NOTIFICATION TO ALL POLL SUBS
        const votes = await prisma.vote.findMany({
            where: {
                pollId: comment.pollId,
            },
            select: {
                subscriptions: {
                    select: {
                        auth: true,
                        endpoint: true,
                        p256dh: true,
                    },
                },
                poll: {
                    select: {
                        title: true,
                    },
                },
            },
        });

        if (!votes.length) {
            return NextResponse.json(comment);
        }

        const payload = JSON.stringify({
            title: 'Nouveau commentaire !',
            body: `Il y a un nouveau commentaire de ${comment.author} sur le sondage ${votes[0].poll.title}`,
            link: `${process.env.DOMAIN}/poll/${comment.pollId}?tab=comments`,
        });

        // OBJECT TO GET UNIQUE SUBS
        const subscriptions: Subscriptions = {};
        votes.forEach((vote) => {
            vote.subscriptions.forEach((sub) => {
                subscriptions[sub.endpoint] = {
                    endpoint: sub.endpoint,
                    keys: {
                        auth: sub.auth,
                        p256dh: sub.p256dh,
                    },
                };
            });
        });

        // REMOVE ENDPOINT FROM MESSAGE AUTHOR
        delete subscriptions[data.exceptEndpoint];

        // SEND NOTIFICATION TO ALL SUBS
        Object.values(subscriptions).forEach((sub) => {
            webpush
                .sendNotification(sub, payload)
                .then((res) => console.log(res))
                .catch((err) => console.log(err));
        });

        return NextResponse.json(comment);
    } catch {
        return NextResponse.json({ message: "Le commentaire n'a pas pu être créé" }, { status: 500 });
    }
}

const bodySchema = z.object({
    comment: z.object({
        author: z.string(),
        text: z.string(),
        pollId: z.string(),
    }),
    exceptEndpoint: z.string(),
});

type Subscriptions = {
    [endpoint: string]: {
        endpoint: string;
        keys: {
            auth: string;
            p256dh: string;
        };
    };
};
