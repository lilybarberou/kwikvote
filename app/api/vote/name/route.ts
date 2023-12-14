import { prisma } from '@/prisma/db';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { voteId, name } = reqSchema.parse(body);

        await prisma.vote.update({
            where: {
                id: voteId,
            },
            data: {
                name,
            },
        });

        return NextResponse.json({ message: 'Le vote a été modifié' });
    } catch (e) {
        if (e instanceof z.ZodError) return NextResponse.json({ message: 'Données incorrectes' }, { status: 400 });
        return NextResponse.json({ message: 'Erreur lors de la création de la subscription' }, { status: 500 });
    }
}

const reqSchema = z.object({
    voteId: z.string(),
    name: z.string(),
});
