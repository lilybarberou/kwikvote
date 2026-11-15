import { prisma } from "@/prisma/db";
import { Prisma } from "@prisma/client";
import { readFileSync } from "node:fs";
import path from "node:path";
import { v4 } from "uuid";
import { afterAll, describe, expect, test } from "vitest";

// One choice per vote and slot (@@unique([voteId, slotId])), and the SQL run
// once in production to remove the copies left by the past edits before
// creating that index (docs/sql/vote-choice-unique*.sql).

const TITLE = "integration test vote choice unique";
const INDEX = "VoteChoice_voteId_slotId_key";

// the statements of a SQL file of docs/sql, without the comments and the
// transaction commands (they run in a Prisma transaction here)
const statements = (file: string) =>
  readFileSync(path.join(__dirname, "../../../docs/sql", file), "utf8")
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(/;\s*(?:\n|$)/)
    .map((statement) => statement.trim())
    .filter((statement) => statement && !/^(BEGIN|COMMIT)$/i.test(statement));

const indexExists = async () =>
  (
    await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) FROM pg_indexes WHERE indexname = ${INDEX}`
  )[0].count === BigInt(1);

const createPoll = (type: number) =>
  prisma.poll.create({
    data: {
      type,
      title: TITLE,
      slots: {
        create: [1, 2].map((day) => ({
          startDate: new Date(Date.UTC(2030, 0, day, 17)),
          endDate: new Date(Date.UTC(2030, 0, day, 19)),
          maxParticipants: 1,
        })),
      },
    },
    include: { slots: { orderBy: { startDate: "asc" } } },
  });

afterAll(async () => {
  // never leave the base without the index, whatever failed
  if (!(await indexExists()))
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX "${INDEX}" ON "VoteChoice"("voteId", "slotId")`,
    );
  await prisma.poll.deleteMany({ where: { title: TITLE } });
  await prisma.$disconnect();
});

describe("one choice per vote and slot (local database)", () => {
  test("a second choice for the same vote and slot is refused", async () => {
    const poll = await createPoll(1);
    const vote = await prisma.vote.create({
      data: { name: "A", pollId: poll.id },
    });
    const choice = { voteId: vote.id, slotId: poll.slots[0].id, choice: 1 };
    await prisma.voteChoice.create({ data: choice });

    const duplicate = prisma.voteChoice.create({
      data: { ...choice, choice: 2 },
    });
    await expect(duplicate).rejects.toBeInstanceOf(
      Prisma.PrismaClientKnownRequestError,
    );
    await expect(duplicate).rejects.toMatchObject({ code: "P2002" });
  });

  test("the SQL keeps the copy written last, reports the others, then creates the index", async () => {
    const free = await createPoll(1);
    const registration = await createPoll(2);
    const [a1, a2] = free.slots.map((slot) => slot.id);
    const [r1, r2] = registration.slots.map((slot) => slot.id);
    const ids = { clean: v4(), upd: v4(), three: v4(), alice: v4() };
    await prisma.vote.createMany({
      data: [
        { id: ids.clean, name: "clean", pollId: free.id },
        { id: ids.upd, name: "updated", pollId: free.id },
        { id: ids.three, name: "three", pollId: free.id },
        { id: ids.alice, name: "Alice", pollId: registration.id },
      ],
    });
    await prisma.slot.update({
      where: { id: r1 },
      data: { registered: [ids.alice] },
    });
    await prisma.slot.update({
      where: { id: r2 },
      data: { notComing: [ids.alice] },
    });

    // the production base before this change: no index, past copies
    await prisma.$executeRawUnsafe(`DROP INDEX "${INDEX}"`);
    // each statement is its own transaction: a later one has a newer xmin
    const insert = (
      id: string,
      voteId: string,
      slotId: string,
      choice: number,
    ) =>
      prisma.$executeRaw`INSERT INTO "VoteChoice" (id, "voteId", "slotId", choice)
        VALUES (${id}, ${voteId}, ${slotId}, ${choice})`;
    await insert("clean-1", ids.clean, a1, 1);
    await insert("clean-2", ids.clean, a2, 2);
    await insert("upd-1-old", ids.upd, a1, 1);
    await insert("upd-2", ids.upd, a2, 1);
    await insert("three-a", ids.three, a1, 1);
    await insert("three-2", ids.three, a2, 1);
    await insert("alice-1", ids.alice, r1, 1);
    await insert("alice-2-old", ids.alice, r2, 1);
    await insert("upd-1-new", ids.upd, a1, 2);
    await insert("three-b", ids.three, a1, 2);
    await insert("three-c", ids.three, a1, 3);
    await insert("alice-2-new", ids.alice, r2, 2);
    // a later edit updated the first copy: it holds the last answer
    await prisma.$executeRaw`UPDATE "VoteChoice" SET choice = 3 WHERE id = 'upd-1-old'`;

    // dry run: reads only
    const [details, totals, inconsistent] = await prisma.$transaction(
      statements("vote-choice-unique-dry-run.sql").map((sql) =>
        prisma.$queryRawUnsafe<Record<string, unknown>[]>(sql),
      ),
    );
    const mine = details.filter((row) =>
      ["updated", "three", "Alice"].includes(row.vote as string),
    );
    expect(mine.map((row) => [row.choiceId, row.action]).sort()).toEqual(
      [
        ["alice-2-new", "keep"],
        ["alice-2-old", "DELETE"],
        ["three-a", "DELETE"],
        ["three-b", "DELETE"],
        ["three-c", "keep"],
        ["upd-1-new", "DELETE"],
        ["upd-1-old", "keep"],
      ].sort(),
    );
    expect(totals[0]).toEqual({
      "votes and slots with copies": BigInt(3),
      "choices to delete": BigInt(4),
    });
    expect(inconsistent).toEqual([]);
    expect(await prisma.voteChoice.count({ where: { id: "three-a" } })).toBe(1);

    // the deduplication, twice: the second run changes nothing
    for (const expected of [4, 0]) {
      const deleted = await prisma.$transaction(async (tx) => {
        let rows: unknown[] = [];
        for (const sql of statements("vote-choice-unique.sql")) {
          if (/^WITH/.test(sql)) rows = await tx.$queryRawUnsafe(sql);
          else await tx.$executeRawUnsafe(sql);
        }
        return rows;
      });
      expect(deleted).toHaveLength(expected);
    }

    const kept = await prisma.voteChoice.findMany({
      where: { voteId: { in: Object.values(ids) } },
      orderBy: { id: "asc" },
    });
    expect(kept.map((c) => [c.id, c.choice])).toEqual([
      ["alice-1", 1],
      ["alice-2-new", 2],
      ["clean-1", 1],
      ["clean-2", 2],
      ["three-2", 1],
      ["three-c", 3],
      ["upd-1-old", 3],
      ["upd-2", 1],
    ]);
    expect(await indexExists()).toBe(true);
  });
});
