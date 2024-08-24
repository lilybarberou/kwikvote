import { prisma } from "@/prisma/db";
import { createSafeActionClient } from "next-safe-action";
import { z } from "zod";

export const action = createSafeActionClient();

// ADMIN ACTION
const adminActionSchema = z.object({ password: z.string() });
export const adminAction = action
  .schema(adminActionSchema)
  .use(async ({ next, clientInput }) => {
    const data = adminActionSchema.parse(clientInput);

    if (data.password !== process.env.ADMIN_PASSWORD)
      throw new Error("Invalid password");

    return next();
  });

// POLL PASSWORD ACTION
const pollPwActionSchema = z.object({
  pollId: z.string(),
  password: z.string(),
});
export const pollPwAction = action
  .schema(pollPwActionSchema)
  .use(async ({ next, clientInput }) => {
    const { password, pollId } = pollPwActionSchema.parse(clientInput);

    if (password === process.env.ADMIN_PASSWORD) return next();

    const poll = await prisma.poll.findFirst({
      where: { id: pollId },
      select: { password: true },
    });
    if (!poll) throw new Error("Poll not found");

    if (poll.password !== password) throw new Error("Invalid password");

    return next();
  });
