"use server";

import { action } from "@/lib/safe-action";
import { prisma } from "@/prisma/db";
import { z } from "zod";

export const deleteSlotById = action
  .schema(z.object({ slotId: z.string() }))
  .action(async ({ parsedInput: { slotId } }) => {
    await prisma.slot.delete({ where: { id: slotId } });
  });
