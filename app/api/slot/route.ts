import { prisma } from "@/prisma/db";
import { NextRequest, NextResponse } from "next/server";

// CREATE SLOT
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const slot = await prisma.slot.create({ data });
    return NextResponse.json(slot);
  } catch {
    return NextResponse.json(
      { message: "Le créneau  n'a pas pu être créé" },
      { status: 500 },
    );
  }
}
