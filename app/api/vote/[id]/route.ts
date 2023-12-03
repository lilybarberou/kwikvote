import { prisma } from '@/prisma/db';
import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
    if (!params.id) return NextResponse.json({ message: 'Missing vote id' }, { status: 400 });
    const body = (await request.json()) as { pollId: string; pollType: number };
    if (!body.pollId || !body.pollType) return NextResponse.json({ message: 'Missing poll infos' }, { status: 400 });

    // REMOVE VOTE FROM ALL SLOTS ARRAYS
    if (body.pollType == 2) {
        const slots = await prisma.slot.findMany({
            where: {
                pollId: body.pollId,
            },
            select: {
                id: true,
                registered: true,
                waitingList: true,
                waitingListReregistered: true,
                notComing: true,
            },
        });

        slots.forEach(async (slot) => {
            slot.registered = slot.registered.filter((voteId) => voteId != params.id);
            slot.waitingList = slot.waitingList.filter((voteId) => voteId != params.id);
            slot.waitingListReregistered = slot.waitingListReregistered.filter((voteId) => voteId != params.id);
            slot.notComing = slot.notComing.filter((voteId) => voteId != params.id);

            await prisma.slot.update({
                where: { id: slot.id },
                data: { ...slot },
            });
        });
    }

    await prisma.voteChoice.deleteMany({ where: { voteId: params.id } });

    const vote = await prisma.vote.delete({
        where: { id: params.id },
    });

    return NextResponse.json(vote);
}
