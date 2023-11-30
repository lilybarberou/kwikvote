import { prisma } from '@/prisma/db';
import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';

export const dynamic = 'force-dynamic';

webpush.setVapidDetails('mailto:' + process.env.NEXT_PUBLIC_VAPID_EMAIL, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
// CREATE COMMENT
export async function POST(request: NextRequest) {
    try {
        const data = await request.json();
        const comment = await prisma.comment.create({ data });

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
            link: `${process.env.DOMAIN}/poll/${comment.pollId}`,
        });

        votes.forEach((vote) => {
            vote.subscriptions.forEach((sub) => {
                const webpushSub = {
                    endpoint: sub.endpoint,
                    keys: {
                        auth: sub.auth,
                        p256dh: sub.p256dh,
                    },
                };

                webpush
                    .sendNotification(webpushSub, payload)
                    .then((res) => console.log(res))
                    .catch((err) => console.log(err));
            });
        });

        return NextResponse.json(comment);
    } catch {
        return NextResponse.json({ message: "Le commentaire n'a pas pu être créé" }, { status: 500 });
    }
}
