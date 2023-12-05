import { prisma } from '@/prisma/db';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

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
                            notComing: true,
                        },
                        orderBy: { startDate: 'asc' },
                    },
                },
            });

            if (!poll) return NextResponse.json({ message: 'Sondage introuvable' }, { status: 404 });

            // CHECK IF VOTE EXISTS TO KNOW IF CREATING OR EDITING
            const voteExists = await prisma.vote.findUnique({
                where: {
                    id: data.id,
                },
                include: {
                    choices: {
                        select: {
                            id: true,
                            slotId: true,
                            choice: true,
                        },
                    },
                },
            });

            let isRegisteredOnce = false;

            await poll.slots.forEach(async (slot) => {
                const voteChoice = data.choices.find((choice) => choice.slotId === slot.id);
                const isFull = slot.registered.length >= slot.maxParticipants;

                if (voteExists) {
                    const oldChoice = voteExists.choices.find((choice) => choice.slotId === slot.id);
                    const choiceChanged = oldChoice?.choice !== voteChoice?.choice;

                    if (choiceChanged) {
                        slot.registered = slot.registered.filter((id) => id !== data.id);
                        slot.waitingList = slot.waitingList.filter((id) => id !== data.id);
                        slot.waitingListReregistered = slot.waitingListReregistered.filter((id) => id !== data.id);
                        slot.notComing = slot.notComing.filter((id) => id !== data.id);
                    } else {
                        if (voteChoice?.choice == 1) {
                            const isRegistered = slot.registered.includes(data.id);

                            // premier créneau où il est inscrit, on le laisse inscrit
                            if (isRegistered && !isRegisteredOnce) {
                                isRegisteredOnce = true;
                                return;
                            }
                            // déjà inscrit dans un créneau précédent, on l'enlève des inscrits
                            // (passera en liste d'attente dans la logique suivante)
                            else if (isRegistered && isRegisteredOnce) {
                                slot.registered = slot.registered.filter((id) => id !== data.id);
                            } else {
                                // si pas encore inscrit dans les créneaux précédents et actuellement en
                                // liste d'attente, on le passe en inscrit si registered pas au max
                                if (!isFull) {
                                    // on l'enlève des listes d'attentes, il sera inscrit dans la logique juste après
                                    slot.waitingList = slot.waitingList.filter((id) => id !== data.id);
                                    slot.waitingListReregistered = slot.waitingListReregistered.filter((id) => id !== data.id);
                                }
                            }
                        }
                        // aucun changement à faire si toujours non
                        else return;
                    }
                }

                if (voteChoice?.choice == 2) {
                    slot.notComing.push(data.id);
                } else {
                    // pas rempli -> on ajoute aux inscrits
                    if (!isFull && !isRegisteredOnce) {
                        slot.registered.push(data.id);
                        isRegisteredOnce = true;
                    }
                    // rempli et inscrit nul part -> on ajoute en liste d'attente
                    else if (!isRegisteredOnce) {
                        slot.waitingList.push(data.id);
                    }
                    // déjà inscrit quelque part -> on ajoute en liste d'attente des réinscrits
                    else slot.waitingListReregistered.push(data.id);
                }

                const updatedSlot = await prisma.slot.update({
                    where: { id: slot.id },
                    data: { ...slot },
                });

                newSlotsArrays[slot.id] = {
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
