import { prisma } from "@/prisma/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// DELETE POLLS BY ID
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password, pollIds } = bodySchema.parse(body);

    // check admin password
    if (password !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json(
        { message: "Mot de passe incorrect" },
        { status: 401 },
      );
    }

    await prisma.comment.deleteMany({ where: { pollId: { in: pollIds } } });
    await prisma.voteChoice.deleteMany({
      where: { vote: { pollId: { in: pollIds } } },
    });
    await prisma.vote.deleteMany({ where: { pollId: { in: pollIds } } });
    await prisma.slot.deleteMany({ where: { pollId: { in: pollIds } } });
    await prisma.cronSchedule.deleteMany({
      where: { pollId: { in: pollIds } },
    });
    await prisma.poll.deleteMany({ where: { id: { in: pollIds } } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.log(err);
    return NextResponse.json(
      { message: "Le sondage n'a pas pu être supprimé" },
      { status: 500 },
    );
  }
}

const bodySchema = z.object({
  password: z.string(),
  pollIds: z.array(z.string()),
});
