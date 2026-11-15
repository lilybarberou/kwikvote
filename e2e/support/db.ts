import { PrismaClient } from "@prisma/client";

import { getLocalDatabaseUrl } from "./env";

// Reads of the LOCAL database of the suite (getLocalDatabaseUrl refuses any
// other host), to check what the app stored, not only what it shows.
export const db = new PrismaClient({ datasourceUrl: getLocalDatabaseUrl() });

// the stored choices of a vote, in the order of the slots
export const getStoredChoices = async (pollId: string, name: string) => {
  const vote = await db.vote.findFirstOrThrow({
    where: { pollId, name },
    include: { choices: { include: { slot: true } } },
  });
  return vote.choices
    .sort((a, b) => a.slot.startDate.getTime() - b.slot.startDate.getTime())
    .map(({ choice, priority }) => ({ choice, priority }));
};
