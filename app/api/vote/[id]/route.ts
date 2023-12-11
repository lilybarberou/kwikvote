import { prisma } from '@/prisma/db';
import { Prisma } from '@prisma/client';
import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';
import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';

export const dynamic = 'force-dynamic';

webpush.setVapidDetails('mailto:' + process.env.NEXT_PUBLIC_VAPID_EMAIL, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
    if (!params.id) return NextResponse.json({ message: 'Missing vote id' }, { status: 400 });
    const body = (await request.json()) as { pollId: string; pollType: number };
    if (!body.pollId || !body.pollType) return NextResponse.json({ message: 'Missing poll infos' }, { status: 400 });

    let newPoll: Poll | undefined = undefined;

    // REMOVE VOTE FROM ALL SLOTS ARRAYS
    if (body.pollType == 2) {
        const poll = await prisma.poll.findUnique({
            where: { id: body.pollId },
            select: { ...pollInclude },
        });

        if (!poll) return NextResponse.json({ message: 'Sondage introuvable' }, { status: 404 });
        const initialPoll = JSON.parse(JSON.stringify(poll.slots)) as Poll['slots'];

        // remove vote from all slots arrays
        poll.slots.forEach((slot) => {
            slot.registered = slot.registered.filter((voteId) => voteId != params.id);
            slot.waitingList = slot.waitingList.filter((voteId) => voteId != params.id);
            slot.waitingListReregistered = slot.waitingListReregistered.filter((voteId) => voteId != params.id);
            slot.notComing = slot.notComing.filter((voteId) => voteId != params.id);
        });
        newPoll = JSON.parse(JSON.stringify(poll)) as Poll;

        // check if still place in registered
        let voteIdToRegister = '';
        poll.slots.forEach((slot) => {
            if (slot.registered.length < slot.maxParticipants) {
                if (slot.waitingList.length > 0) {
                    voteIdToRegister = slot.waitingList[0];
                }
            }
        });

        if (voteIdToRegister) {
            const timeBeforeAllowedPassed = checkTimeBeforeAllow({
                timeBeforeAllowedType: poll.timeBeforeAllowedType,
                msBeforeAllowed: poll.msBeforeAllowed,
                slots: poll.slots,
            });

            newPoll = await updateSlotsArray({ poll, voteId: voteIdToRegister, timeBeforeAllowedPassed });

            // get new people registered to send notifications
            const votesNewlyRegistered = newPoll.slots.reduce(
                (obj, slot) => {
                    obj.votesBySlot[slot.id] = [];
                    const oldRegistered = initialPoll.find((slot) => slot.id === slot.id)!.registered;

                    // get id addded in registered
                    const newRegistered = slot.registered.filter((id) => !oldRegistered.includes(id));

                    // push ids which are not in array yet
                    newRegistered.forEach((id) => {
                        if (!obj.votes.includes(id) && id !== params.id) {
                            obj.votes.push(id);
                            obj.votesBySlot[slot.id].push(id);
                        }
                    });

                    return obj;
                },
                { votesBySlot: {}, votes: [] } as { votesBySlot: { [slotId: string]: string[] }; votes: string[] }
            );

            // get subs from all the votes
            const votesWithSub = await prisma.vote.findMany({
                where: {
                    id: { in: votesNewlyRegistered.votes },
                },
                select: {
                    id: true,
                    subscriptions: {
                        select: {
                            auth: true,
                            endpoint: true,
                            p256dh: true,
                        },
                    },
                },
            });

            // send notifications
            Object.entries(votesNewlyRegistered.votesBySlot).forEach(([slotId, votes]) => {
                const slot = poll.slots.find((slot) => slot.id === slotId)!;
                const formattedDate = format(slot.startDate, 'eeee d', { locale: fr });
                const formattedTime = slot.startTime.replace(':', 'h');

                const payload = JSON.stringify({
                    title: 'Vous êtes inscrit !',
                    body: `Bonne nouvelle, vous avez intégré les inscrits du ${formattedDate} à ${formattedTime} !`,
                    link: `${process.env.DOMAIN}/poll/${body.pollId}`,
                });

                votes.forEach((vote) => {
                    const voteSubs = votesWithSub.find((voteWithSub) => voteWithSub.id === vote)?.subscriptions;
                    if (!voteSubs) return;

                    voteSubs.forEach((sub) => {
                        webpush
                            .sendNotification(
                                {
                                    endpoint: sub.endpoint,
                                    keys: {
                                        auth: sub.auth,
                                        p256dh: sub.p256dh,
                                    },
                                },
                                payload
                            )
                            .then((res) => console.log('notif envoyée: ', res.statusCode))
                            .catch((err) => console.log(err));
                    });
                });
            });
        }

        // update slots in db
        for (const slot of newPoll.slots) {
            await prisma.slot.update({
                where: { id: slot.id },
                data: slot,
            });
        }
    }

    await prisma.voteChoice.deleteMany({ where: { voteId: params.id } });

    await prisma.vote.delete({
        where: { id: params.id },
    });

    // obj slot by id
    const slotsByID = newPoll?.slots.reduce((obj, slot) => {
        obj[slot.id] = slot;
        return obj;
    }, {} as Record<string, Poll['slots'][0]>);

    return NextResponse.json({ slots: slotsByID });
}

const updateSlotsArray = async ({
    poll,
    voteId,
    timeBeforeAllowedPassed,
}: {
    poll: Poll;
    voteId: string;
    timeBeforeAllowedPassed: Record<string, boolean>;
}): Promise<Poll> => {
    let isRegisteredOnce = false;

    const currentVoteData = await prisma.vote.findUnique({
        where: { id: voteId },
        select: {
            choices: {
                select: {
                    id: true,
                    slotId: true,
                    choice: true,
                },
            },
        },
    });

    for (const slot of poll.slots) {
        const isFull = slot.registered.length >= slot.maxParticipants;
        const currentVoteChoice = currentVoteData!.choices.find((choice) => choice.slotId === slot.id);

        if (currentVoteChoice?.choice == 1) {
            const isRegistered = slot.registered.includes(voteId);

            // premier créneau où il est inscrit, on le laisse inscrit
            if (isRegistered && !isRegisteredOnce) {
                isRegisteredOnce = true;
                continue;
            }
            // déjà inscrit dans un créneau précédent, on l'enlève des inscrits
            // (passera en liste d'attente dans la logique suivante)
            else if (isRegistered && isRegisteredOnce) {
                // if time passed and reregistered allowed we can leave it
                if (timeBeforeAllowedPassed[slot.id]) {
                    isRegisteredOnce = true;
                    continue;
                }
                // else remove from registered (will be in reregistered waiting list)
                else slot.registered = slot.registered.filter((id) => id !== voteId);
            }
            // not registered yet -> actually in wl or wlr
            else {
                const isWaitingList = slot.waitingList.includes(voteId);
                const isWaitingListReregistered = slot.waitingListReregistered.includes(voteId);
                const isAllowedToRegister = !isRegisteredOnce || timeBeforeAllowedPassed[slot.id];

                if (isFull) {
                    // if allowed to reregister -> must be in wl
                    if (isAllowedToRegister) {
                        if (isWaitingListReregistered) slot.waitingListReregistered = slot.waitingListReregistered.filter((id) => id !== voteId);
                        else continue;
                    }
                    // else -> must be in wlr
                    else {
                        if (isWaitingList) slot.waitingList = slot.waitingList.filter((id) => id !== voteId);
                        else continue;
                    }
                } else {
                    // if allowed to reregister -> remove from all wl -> will be in registered
                    if (isAllowedToRegister) {
                        slot.waitingListReregistered = slot.waitingListReregistered.filter((id) => id !== voteId);
                        slot.waitingList = slot.waitingList.filter((id) => id !== voteId);
                    }
                    // else -> must be in wlr
                    else {
                        if (isWaitingList) slot.waitingList = slot.waitingList.filter((id) => id !== voteId);
                        else continue;
                    }
                }
            }
        }
        // no changes if still no
        else continue;

        // not full -> add to registered
        if (!isFull && (!isRegisteredOnce || timeBeforeAllowedPassed[slot.id])) {
            slot.registered.push(voteId);
            isRegisteredOnce = true;
        }
        // full and not registered anywhere -> add to waiting list
        else if (!isRegisteredOnce) slot.waitingList.push(voteId);
        // already registered somewhere -> add to reregistered waiting list
        else slot.waitingListReregistered.push(voteId);
    }

    // ----- CHECK SI IL RESTE DE LA PLACE DANS LES INSCRITS D'UN CRENEAU -----
    let voteIdToRegister = '';
    poll.slots.forEach((slot) => {
        if (slot.registered.length < slot.maxParticipants) {
            if (slot.waitingList.length > 0) {
                voteIdToRegister = slot.waitingList[0];
                return;
            }
        }
    });

    if (voteIdToRegister) {
        poll = await updateSlotsArray({ poll, voteId: voteIdToRegister, timeBeforeAllowedPassed });
    }

    return poll;
};

const checkTimeBeforeAllow = ({
    timeBeforeAllowedType,
    msBeforeAllowed,
    slots,
}: {
    timeBeforeAllowedType: number;
    msBeforeAllowed: number;
    slots: Poll['slots'];
}) => {
    return slots.reduce((obj, curr) => {
        const now = new Date();

        // date to compare is day before at 5pm
        if (timeBeforeAllowedType == 1) {
            const dateToCompare = new Date(curr.startDate);
            dateToCompare.setDate(dateToCompare.getDate() - 1);
            dateToCompare.setHours(17, 0, 0, 0);

            obj[curr.id] = now.getTime() > dateToCompare.getTime();
        }
        // specific hours number before startDate
        else {
            const slotDate = new Date(curr.startDate);
            const hours = curr.startTime.split(':')[0];
            const minutes = curr.startTime.split(':')[1];
            const slotDateTime = new Date(slotDate.setHours(+hours, +minutes));

            obj[curr.id] = now.getTime() > slotDateTime.getTime() - msBeforeAllowed;
        }
        return obj;
    }, {} as Record<string, boolean>);
};

const pollInclude = Prisma.validator<Prisma.PollSelect>()({
    title: true,
    timeBeforeAllowedType: true,
    msBeforeAllowed: true,
    slots: {
        select: {
            id: true,
            startDate: true,
            startTime: true,
            maxParticipants: true,
            registered: true,
            waitingList: true,
            waitingListReregistered: true,
            notComing: true,
        },
        orderBy: {
            startDate: 'asc',
        },
    },
});

type Poll = Prisma.PollGetPayload<{ select: typeof pollInclude }>;
