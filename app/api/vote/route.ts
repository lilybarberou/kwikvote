import { prisma } from '@/prisma/db';
import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

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

            newSlotsArrays = await updateSlotsArray({
                poll,
                voteId: data.id,
                initialVoteChoices: data.choices,
                initialVoteOldChoices: voteInDB?.choices,
                firstCall: true,
                voteExists: !!voteInDB,
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
    firstCall,
}: {
    poll: Poll;
    voteId: string;
    initialVoteChoices: Choice[];
    initialVoteOldChoices?: Choice[];
    voteExists: boolean;
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
                        slot.registered = slot.registered.filter((id) => id !== voteId);
                    } else {
                        // si pas encore inscrit dans les créneaux précédents et actuellement en
                        // liste d'attente, on le passe en inscrit si registered pas au max
                        if (!isFull) {
                            // on l'enlève des listes d'attentes, il sera inscrit dans la logique juste après
                            slot.waitingList = slot.waitingList.filter((id) => id !== voteId);
                            slot.waitingListReregistered = slot.waitingListReregistered.filter((id) => id !== voteId);
                        }
                    }
                }
                // aucun changement à faire si toujours non
                else continue;
            }
        }

        if (currentVoteChoice?.choice == 2) slot.notComing.push(voteId);
        else {
            // pas rempli -> on ajoute aux inscrits
            if (!isFull && !isRegisteredOnce) {
                slot.registered.push(voteId);
                isRegisteredOnce = true;
            }
            // rempli et inscrit nul part -> on ajoute en liste d'attente
            else if (!isRegisteredOnce) slot.waitingList.push(voteId);
            // déjà inscrit quelque part -> on ajoute en liste d'attente des réinscrits
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
        const resNewSlotsArrays = await updateSlotsArray({ poll, voteId: voteIdToRegister, initialVoteChoices, voteExists: true });

        // update newSlotsArrays
        Object.keys(resNewSlotsArrays).forEach((slotId) => {
            newSlotsArrays[slotId] = resNewSlotsArrays[slotId];
        });
    }
    return newSlotsArrays;
};

const pollInclude = Prisma.validator<Prisma.PollInclude>()({
    slots: {
        select: {
            id: true,
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
