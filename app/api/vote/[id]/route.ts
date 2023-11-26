import { prisma } from '@/prisma/db';
import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
    if (!params.id) return NextResponse.json({ message: 'Missing vote id' }, { status: 400 });

    await prisma.voteChoice.deleteMany({ where: { voteId: params.id } });
    const vote = await prisma.vote.delete({
        where: { id: params.id },
    });

    return NextResponse.json(vote);
}
