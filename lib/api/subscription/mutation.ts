"use server";

import { action } from "@/lib/safe-action";
import { createSubscriptionSchema } from "@/lib/schema/subscription-schema";
import { prisma } from "@/prisma/db";

export const createSubscription = action
  .schema(createSubscriptionSchema)
  .action(async ({ parsedInput: data }) => {
    // a browser subscribing again can get the same endpoint
    const subscription = await prisma.subscription.upsert({
      where: { endpoint: data.endpoint },
      update: {
        auth: data.keys.auth,
        p256dh: data.keys.p256dh,
      },
      create: {
        endpoint: data.endpoint,
        auth: data.keys.auth,
        p256dh: data.keys.p256dh,
      },
    });
    return subscription;
  });
