import { prisma } from '@/prisma/db';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export async function GET(_: NextRequest) {
    const polls = await prisma.poll.findMany();
    return NextResponse.json(polls);
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const data = CreatePollSchema.parse(body);

        const poll = await prisma.poll.create({
            data: {
                title: data.title,
                description: data.description,
                email: data.email,
                slots: {
                    create: data.slots.map((slot: z.infer<typeof CreateSlotSchema>) => ({
                        ...slot,
                        startDate: new Date(slot.startDate),
                        endDate: new Date(slot.endDate),
                    })),
                },
            },
        });

        return NextResponse.json(poll);
    } catch (e) {
        if (e instanceof z.ZodError) return NextResponse.json({ message: 'Données incorrectes' }, { status: 400 });
        return NextResponse.json({ message: 'Erreur lors de la création du sondage' }, { status: 500 });
    }
}

const CreateSlotSchema = z.object({
    startDate: z.string(),
    startTime: z.string(),
    endDate: z.string(),
    endTime: z.string(),
    maxParticipants: z.number().int().positive(),
});

const CreatePollSchema = z.object({
    title: z.string(),
    description: z.string().optional(),
    email: z.string().email().optional().or(z.literal('')),
    slots: z.array(CreateSlotSchema),
});
