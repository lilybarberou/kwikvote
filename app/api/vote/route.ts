import { prisma } from '@/prisma/db';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

type NewVoteArray = {
    [slotId: string]: {
        addInRegistered: boolean;
        addInWaitingList: boolean;
        addInWaitingListReregistered: boolean;
        addInNotComing: boolean;
    };
};

type NewSlotsArrays = {
    [slotId: string]: {
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

        if (data.pollType == 2) {
            // CHECK IN WHICH ARRAY THE VOTE WILL BE
            const poll = await prisma.poll.findUnique({
                where: {
                    id: data.pollId,
                },
                select: {
                    slots: {
                        select: {
                            id: true,
                            maxParticipants: true,
                            registered: true,
                            waitingList: true,
                            waitingListReregistered: true,
                        },
                        orderBy: { startDate: 'asc' },
                    },
                },
            });

            if (!poll) return NextResponse.json({ message: 'Sondage introuvable' }, { status: 404 });

            let isRegisteredOnce = false;
            const newVoteArray: NewVoteArray = {};

            poll.slots.forEach((slot) => {
                newVoteArray[slot.id] = {
                    addInRegistered: false,
                    addInWaitingList: false,
                    addInWaitingListReregistered: false,
                    addInNotComing: false,
                };

                const voteChoice = data.choices.find((choice) => choice.slotId === slot.id);
                if (voteChoice?.choice == 2) {
                    newVoteArray[slot.id].addInNotComing = true;
                    return;
                }

                const isFull = slot.registered.length >= slot.maxParticipants;

                // pas rempli -> on ajoute aux inscrits
                if (!isFull && !isRegisteredOnce) {
                    newVoteArray[slot.id].addInRegistered = true;
                    isRegisteredOnce = true;
                }
                // rempli et inscrit nul part -> on ajoute en liste d'attente
                else if (!isRegisteredOnce) {
                    newVoteArray[slot.id].addInWaitingList = true;
                }
                // déjà inscrit quelque part -> on ajoute en liste d'attente des réinscrits
                else newVoteArray[slot.id].addInWaitingListReregistered = true;
            });

            // UPDATE SLOTS
            Object.entries(newVoteArray).forEach(async ([slotId, slotArrays]) => {
                const updatedSlot = await prisma.slot.update({
                    where: {
                        id: slotId,
                    },
                    data: {
                        registered: slotArrays.addInRegistered
                            ? {
                                  push: data.id,
                              }
                            : undefined,
                        waitingList: slotArrays.addInWaitingList
                            ? {
                                  push: data.id,
                              }
                            : undefined,
                        waitingListReregistered: slotArrays.addInWaitingListReregistered
                            ? {
                                  push: data.id,
                              }
                            : undefined,
                        notComing: slotArrays.addInNotComing
                            ? {
                                  push: data.id,
                              }
                            : undefined,
                    },
                });

                newSlotsArrays[slotId] = {
                    registered: updatedSlot.registered,
                    waitingList: updatedSlot.waitingList,
                    waitingListReregistered: updatedSlot.waitingListReregistered,
                    notComing: updatedSlot.notComing,
                };
            });
        }

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

        return NextResponse.json({ newSlotsArrays });
    } catch (e) {
        console.log(e);
        if (e instanceof z.ZodError) return NextResponse.json({ message: 'Données incorrectes' }, { status: 400 });
        return NextResponse.json({ message: "Le vote n'a pas pu être créé" }, { status: 500 });
    }
}

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
