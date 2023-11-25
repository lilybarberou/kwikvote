import { prisma } from '@/prisma/db';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// CREATE VOTE
export async function POST(request: NextRequest) {
    try {
        const data = await request.json();
        createVoteSchema.parse(data);

        const vote = await prisma.vote.create({
            data: {
                name: data.name,
                poll: {
                    connect: {
                        id: data.pollId,
                    },
                },
                choices: {
                    create: data.choices.map((choice: { slotId: string; choice: number }) => ({
                        slot: {
                            connect: {
                                id: choice.slotId,
                            },
                        },
                        choice: choice.choice,
                    })),
                },
            },
        });
        return NextResponse.json(vote);
    } catch (e) {
        if (e instanceof z.ZodError) return NextResponse.json({ message: 'Données incorrectes' }, { status: 400 });
        return NextResponse.json({ message: "Le vote n'a pas pu être créé" }, { status: 500 });
    }
}

const createVoteSchema = z.object({
    name: z.string(),
    pollId: z.string(),
    choices: z.array(
        z.object({
            slotId: z.string(),
            choice: z.number(),
        })
    ),
});
