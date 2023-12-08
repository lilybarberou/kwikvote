import { prisma } from '@/prisma/db';
import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import webpush from 'web-push';
import { format } from 'date-fns';
import fr from 'date-fns/locale/fr';

export const dynamic = 'force-dynamic';

webpush.setVapidDetails('mailto:' + process.env.NEXT_PUBLIC_VAPID_EMAIL, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

type NewSlotsArrays = {
    [slotId: string]: {
        maxParticipants: number;
        registered: string[];
        waitingList: string[];
        waitingListReregistered: string[];
        notComing: string[];
    };
};

// UPDATE VOTE
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const data = createVoteSchema.parse(body);
        let newSlotsArrays: NewSlotsArrays = {};

        const voteInDB = await prisma.vote.findUnique({
            where: { id: data.id },
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

        // UPDATE VOTE IN DB
        await prisma.vote.upsert({
            where: {
                id: data.id,
            },
            update: {
                name: data.name,
                choices: {
                    upsert: data.choices.map((choice: { id: string; slotId: string; choice: number }) => ({
                        where: {
                            id: choice.id,
                        },
                        update: {
                            choice: choice.choice,
                        },
                        create: {
                            id: choice.id,
                            choice: choice.choice,
                            slot: {
                                connect: {
                                    id: choice.slotId,
                                },
                            },
                        },
                    })),
                },
                subscriptions: data.subscriptionEndpoint
                    ? {
                          connect: {
                              endpoint: data.subscriptionEndpoint,
                          },
                      }
                    : undefined,
            },
            create: {
                id: data.id,
                name: data.name,
                poll: {
                    connect: {
                        id: data.pollId,
                    },
                },
                choices: {
                    create: data.choices.map((choice: { id: string; slotId: string; choice: number }) => ({
                        id: choice.id,
                        choice: choice.choice,
                        slot: {
                            connect: {
                                id: choice.slotId,
                            },
                        },
                    })),
                },
                subscriptions: data.subscriptionEndpoint
                    ? {
                          connect: {
                              endpoint: data.subscriptionEndpoint,
                          },
                      }
                    : undefined,
            },
        });

        if (data.pollType == 2) {
            const poll = await prisma.poll.findUnique({
                where: { id: data.pollId },
                select: { ...pollInclude },
            });

            if (!poll) return NextResponse.json({ message: 'Sondage introuvable' }, { status: 404 });
            const initialPoll = JSON.parse(JSON.stringify(poll.slots)) as Poll['slots'];

            const timeBeforeAllowedPassed = checkTimeBeforeAllow({
                timeBeforeAllowedType: poll.timeBeforeAllowedType,
                msBeforeAllowed: poll.msBeforeAllowed,
                slots: poll.slots,
            });

            newSlotsArrays = await updateSlotsArray({
                poll,
                timeBeforeAllowedPassed,
                voteId: data.id,
                initialVoteChoices: data.choices,
                initialVoteOldChoices: voteInDB?.choices,
                firstCall: true,
                voteExists: !!voteInDB,
            });

            // get new people registered to send notifications
            const votesNewlyRegistered = Object.entries(newSlotsArrays).reduce(
                (obj, [slotId, newSlotArrays]) => {
                    obj.votesBySlot[slotId] = [];
                    const oldRegistered = initialPoll.find((slot) => slot.id === slotId)!.registered;

                    // get id addded in registered
                    const newRegistered = newSlotArrays.registered.filter((id) => !oldRegistered.includes(id));

                    // push ids which are not in array yet
                    newRegistered.forEach((id) => {
                        if (!obj.votes.includes(id) && id !== data.id) {
                            obj.votes.push(id);
                            obj.votesBySlot[slotId].push(id);
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
                    link: `${process.env.DOMAIN}/poll/${data.pollId}`,
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
                            .then((res) => console.log(res))
                            .catch((err) => console.log(err));
                    });
                });
            });
        }

        return NextResponse.json({ newSlotsArrays });
    } catch (e) {
        console.log(e);
        if (e instanceof z.ZodError) return NextResponse.json({ message: 'Données incorrectes' }, { status: 400 });
        return NextResponse.json({ message: "Le vote n'a pas pu être créé" }, { status: 500 });
    }
}

const updateSlotsArray = async ({
    poll,
    voteId,
    initialVoteChoices,
    initialVoteOldChoices,
    voteExists,
    timeBeforeAllowedPassed,
    firstCall,
}: {
    poll: Poll;
    voteId: string;
    initialVoteChoices: Choice[];
    initialVoteOldChoices?: Choice[];
    voteExists: boolean;
    timeBeforeAllowedPassed: Record<string, boolean>;
    firstCall?: boolean;
}) => {
    let newSlotsArrays: NewSlotsArrays = {};
    let isRegisteredOnce = false;

    // check si le vote existe (uniquement pour celui reçu dans l'api)
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
        const currentVoteChoice = [...(firstCall ? initialVoteChoices : currentVoteData!.choices)].find((choice) => choice.slotId === slot.id);

        // if its an edit
        if (voteExists) {
            const oldChoice = firstCall ? initialVoteOldChoices!.find((choice) => choice.slotId === slot.id)! : undefined;
            const choiceChanged = firstCall ? oldChoice?.choice !== currentVoteChoice?.choice : false;

            if (choiceChanged) {
                slot.registered = slot.registered.filter((id) => id !== voteId);
                slot.waitingList = slot.waitingList.filter((id) => id !== voteId);
                slot.waitingListReregistered = slot.waitingListReregistered.filter((id) => id !== voteId);
                slot.notComing = slot.notComing.filter((id) => id !== voteId);
            } else {
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
            }
        }

        if (currentVoteChoice?.choice == 2) slot.notComing.push(voteId);
        else {
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

        const updatedSlot = await prisma.slot.update({
            where: { id: slot.id },
            data: { ...slot },
        });

        newSlotsArrays[slot.id] = {
            maxParticipants: slot.maxParticipants,
            registered: updatedSlot.registered,
            waitingList: updatedSlot.waitingList,
            waitingListReregistered: updatedSlot.waitingListReregistered,
            notComing: updatedSlot.notComing,
        };
    }

    // ----- CHECK SI IL RESTE DE LA PLACE DANS LES INSCRITS D'UN CRENEAU -----
    let voteIdToRegister = '';
    Object.values(newSlotsArrays).forEach((slot) => {
        if (slot.registered.length < slot.maxParticipants) {
            if (slot.waitingList.length > 0) {
                voteIdToRegister = slot.waitingList[0];
                return;
            }
        }
    });

    if (voteIdToRegister) {
        const resNewSlotsArrays = await updateSlotsArray({ poll, voteId: voteIdToRegister, initialVoteChoices, voteExists: true, timeBeforeAllowedPassed });

        // update newSlotsArrays
        Object.keys(resNewSlotsArrays).forEach((slotId) => {
            newSlotsArrays[slotId] = resNewSlotsArrays[slotId];
        });
    }
    return newSlotsArrays;
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
type Choice = {
    id: string;
    slotId: string;
    choice: number;
};

const createVoteSchema = z.object({
    id: z.string(),
    name: z.string(),
    pollId: z.string(),
    pollType: z.number(),
    choices: z.array(
        z.object({
            id: z.string(),
            slotId: z.string(),
            choice: z.number(),
        })
    ),
    subscriptionEndpoint: z.string().optional(),
});
