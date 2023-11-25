import { prisma } from '@/prisma/db';
import { NextRequest, NextResponse } from 'next/server';

// CREATE COMMENT
export async function POST(request: NextRequest) {
    try {
        const data = await request.json();
        const comment = await prisma.comment.create({ data });
        return NextResponse.json(comment);
    } catch {
        return NextResponse.json({ message: "Le commentaire n'a pas pu être créé" }, { status: 500 });
    }
}
