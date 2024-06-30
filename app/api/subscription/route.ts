import { prisma } from "@/prisma/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = createSubscriptionSchema.parse(body);

    const subscription = await prisma.subscription.create({
      data: {
        endpoint: data.endpoint,
        auth: data.keys.auth,
        p256dh: data.keys.p256dh,
      },
    });

    return NextResponse.json(subscription);
  } catch (e) {
    if (e instanceof z.ZodError)
      return NextResponse.json(
        { message: "Données incorrectes" },
        { status: 400 },
      );
    return NextResponse.json(
      { message: "Erreur lors de la création de la subscription" },
      { status: 500 },
    );
  }
}

const createSubscriptionSchema = z.object({
  endpoint: z.string(),
  keys: z.object({
    auth: z.string(),
    p256dh: z.string(),
  }),
});
