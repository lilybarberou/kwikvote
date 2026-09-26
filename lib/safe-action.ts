import { prisma } from "@/prisma/db";
import { Prisma } from "@prisma/client";
import { createSafeActionClient } from "next-safe-action";
import { z } from "zod";

import { env } from "./env";

// error whose message is meant for the user, other errors are hidden
export class ActionError extends Error {}

export const action = createSafeActionClient({
  handleServerError: (error) => {
    console.error("Action error:", error.message);

    if (error instanceof ActionError) return error.message;

    // poll lock not obtained in time (lock_timeout) or transaction timeout
    const isPollBusy =
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2028" ||
        (error.code === "P2010" && error.meta?.code === "55P03"));
    if (isPollBusy)
      return "Le sondage est très sollicité, réessayez dans un instant";

    return "Une erreur est survenue, veuillez réessayer plus tard";
  },
});

// ADMIN ACTION
const adminActionSchema = z.object({ password: z.string() });
export const adminAction = action
  .schema(adminActionSchema)
  .use(async ({ next, clientInput }) => {
    const data = adminActionSchema.parse(clientInput);

    if (data.password !== env.ADMIN_PASSWORD)
      throw new ActionError("Mot de passe incorrect");

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

    if (password === env.ADMIN_PASSWORD) return next();

    const poll = await prisma.poll.findFirst({
      where: { id: pollId },
      select: { password: true },
    });
    if (!poll) throw new ActionError("Ce sondage n'existe plus");

    // a poll created without password can't be managed
    if (!poll.password || poll.password !== password)
      throw new ActionError("Mot de passe incorrect");

    return next();
  });
