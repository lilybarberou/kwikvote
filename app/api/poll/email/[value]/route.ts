import { prisma } from '@/prisma/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/poll/email/:email
// GET POLL BY EMAIL
export async function GET(_: NextRequest, { params }: { params: { value: string } }) {
    if (!params.value) return NextResponse.json({ message: 'Missing email' }, { status: 400 });

    const poll = await prisma.poll.findMany({
        where: { email: params.value },
        select: {
            id: true,
            title: true,
            createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(poll);
}
