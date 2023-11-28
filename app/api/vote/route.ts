import { prisma } from '@/prisma/db';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// UPDATE VOTE
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const data = createVoteSchema.parse(body);

        const vote = await prisma.vote.upsert({
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
        return NextResponse.json(vote);
    } catch (e) {
        if (e instanceof z.ZodError) return NextResponse.json({ message: 'Données incorrectes' }, { status: 400 });
        return NextResponse.json({ message: "Le vote n'a pas pu être créé" }, { status: 500 });
    }
}

const createVoteSchema = z.object({
    id: z.string(),
    name: z.string(),
    pollId: z.string(),
    choices: z.array(
        z.object({
            id: z.string(),
            slotId: z.string(),
            choice: z.number(),
        })
    ),
    subscriptionEndpoint: z.string().optional(),
});
