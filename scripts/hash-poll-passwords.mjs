// Hashes the poll passwords still stored in clear (the polls created before
// lib/poll-password.mjs). Without --apply: a dry run, it only counts them.
//
//   DATABASE_URL=… node scripts/hash-poll-passwords.mjs            # dry run
//   DATABASE_URL=… node scripts/hash-poll-passwords.mjs --apply    # hashes
//
// Rerunnable: a hashed password is never hashed again. No password is printed.
import { PrismaClient } from "@prisma/client";
import { fileURLToPath } from "node:url";

import { hashPollPassword } from "../lib/poll-password.mjs";

/**
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {{ apply?: boolean }} options
 */
export const hashPlainPollPasswords = async (
  prisma,
  { apply = false } = {},
) => {
  const polls = await prisma.poll.findMany({
    where: {
      password: { not: "" },
      NOT: { password: { startsWith: "scrypt$" } },
    },
    select: { id: true, password: true },
  });

  let hashed = 0;
  if (apply)
    for (const poll of polls) {
      // only if it didn't change meanwhile (a sign in may have hashed it)
      const { count } = await prisma.poll.updateMany({
        where: { id: poll.id, password: poll.password },
        data: { password: await hashPollPassword(poll.password) },
      });
      hashed += count;
    }

  return { inClear: polls.length, hashed };
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const apply = process.argv.includes("--apply");
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  // the host only, never the credentials
  console.log(`Database: ${new URL(url).host}${apply ? "" : " (dry run)"}`);

  const prisma = new PrismaClient();
  try {
    const { inClear, hashed } = await hashPlainPollPasswords(prisma, {
      apply,
    });
    console.log(`Poll passwords in clear: ${inClear}`);
    if (apply) console.log(`Hashed: ${hashed}`);
  } finally {
    await prisma.$disconnect();
  }
}
