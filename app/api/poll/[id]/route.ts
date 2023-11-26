import { prisma } from '@/prisma/db';
import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/poll/:id
// GET POLL BY ID
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
    if (!params.id) return NextResponse.json({ message: 'Missing poll id' }, { status: 400 });

    const poll = await prisma.poll.findUnique({
        where: { id: params.id },
        include: pollInclude,
    });

    return NextResponse.json(poll);
}

const pollInclude = Prisma.validator<Prisma.PollInclude>()({
    comments: true,
    slots: {
        select: { id: true, startDate: true, startTime: true, endDate: true, endTime: true },
        orderBy: { startDate: 'asc' },
    },
    votes: {
        select: {
            id: true,
            name: true,
            choices: {
                select: { id: true, choice: true, slotId: true },
                orderBy: {
                    slot: { startDate: 'asc' },
                },
            },
        },
        orderBy: { createdAt: 'asc' },
    },
});

export type CompletePoll = Prisma.PollGetPayload<{ include: typeof pollInclude }>;
export type PollVote = CompletePoll['votes'][0];
