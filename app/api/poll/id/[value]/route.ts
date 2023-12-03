import { prisma } from '@/prisma/db';
import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/poll/id/:id
// GET POLL BY ID
export async function GET(_: NextRequest, { params }: { params: { value: string } }) {
    if (!params.value) return NextResponse.json({ message: 'Missing poll id' }, { status: 400 });

    const poll = await prisma.poll.findUnique({
        where: { id: params.value },
        include: pollInclude,
    });

    return NextResponse.json(poll);
}

const pollInclude = Prisma.validator<Prisma.PollInclude>()({
    comments: true,
    slots: {
        select: {
            id: true,
            startDate: true,
            startTime: true,
            endDate: true,
            endTime: true,
            maxParticipants: true,
            registered: true,
            waitingList: true,
            waitingListReregistered: true,
            notComing: true,
        },
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
export type PollSlot = CompletePoll['slots'][0];
export type PollVote = CompletePoll['votes'][0];
export type PollVoteChoice = PollVote['choices'][0];
