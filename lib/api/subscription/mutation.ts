"use server";

import { action } from "@/lib/safe-action";
import { createSubscriptionSchema } from "@/lib/schema/subscription-schema";
import { prisma } from "@/prisma/db";

export const createSubscription = action
  .inputSchema(createSubscriptionSchema)
  .action(async ({ parsedInput: data }) => {
    // a browser subscribing again can get the same endpoint, with new keys:
    // they replace the old ones. Only the browser knows its endpoint (the
    // polls send a hash of it, lib/subscription-hash.ts), so nobody else can
    // replace its keys.
    await prisma.subscription.upsert({
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
    // nothing sent back: the browser already has its subscription
    return { success: true };
  });
