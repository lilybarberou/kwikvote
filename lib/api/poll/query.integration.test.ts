import { prisma } from "@/prisma/db";
import { v4 } from "uuid";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import { createVote } from "../vote/mutation";
import { deletePoll, updatePoll } from "./mutation";
import {
  getPollById,
  getPolls,
  getPollsByEmail,
  isPollPasswordValid,
} from "./query";

vi.mock("@/lib/notifications.server", () => ({
  sendNotifications: async () => {},
  sendSlotUpdateNotifications: async () => {},
}));

const TITLE = "integration test poll queries";
const PASSWORD = "poll-password";
const ADMIN = process.env.ADMIN_PASSWORD!;

// the admin session cookie of the request (lib/admin-session.server.ts),
// signed in for the getPolls tests only
const adminSession = vi.hoisted(() => ({ valid: false }));
vi.mock("@/lib/admin-session.server", () => ({
  hasAdminSession: async () => adminSession.valid,
}));
// unique to this run: the database can hold other tests polls
const run = v4().slice(0, 8);
const email = `owner-${run}@example.invalid`;

const errors = vi.spyOn(console, "error").mockImplementation(() => {});

const createPoll = (
  data: {
    title?: string;
    password?: string;
    email?: string;
    description?: string;
  } = {},
) =>
  prisma.poll.create({
    data: {
      title: TITLE,
      ...data,
      slots: {
        create: [2, 0, 1].map((day) => ({
          startDate: new Date(Date.UTC(2099, 5, 10 + day, 16)),
          endDate: new Date(Date.UTC(2099, 5, 10 + day, 18)),
        })),
      },
    },
    include: { slots: true },
  });

afterAll(async () => {
  errors.mockRestore();
  await prisma.poll.deleteMany({
    where: { OR: [{ title: { startsWith: TITLE } }, { email }] },
  });
  await prisma.$disconnect();
});

describe("getPollById", () => {
  test("never sends the password, only whether there is one", async () => {
    const withPassword = await createPoll({ password: PASSWORD });
    const without = await createPoll();

    const res = await getPollById({ pollId: withPassword.id });
    expect(res?.data).toBeDefined();
    expect(res?.data).not.toHaveProperty("password");
    expect(JSON.stringify(res)).not.toContain(PASSWORD);
    expect(res?.data?.hasPassword).toBe(true);

    expect((await getPollById({ pollId: without.id }))?.data?.hasPassword).toBe(
      false,
    );
  });

  test("slots in date order, votes in creation order, choices in slots order", async () => {
    const poll = await createPoll();
    const dates = (slots: { startDate: Date }[]) =>
      slots.map((slot) => slot.startDate.toISOString());
    const sorted = [...poll.slots].sort(
      (a, b) => a.startDate.getTime() - b.startDate.getTime(),
    );

    for (const name of ["first", "second"])
      await createVote({
        id: v4(),
        name,
        pollId: poll.id,
        // sent in another order
        choices: poll.slots.map((slot) => ({
          id: v4(),
          slotId: slot.id,
          choice: 1,
        })),
      });

    const data = (await getPollById({ pollId: poll.id }))?.data!;
    expect(dates(data.slots)).toEqual(dates(sorted));
    expect(data.votes.map((vote) => vote.name)).toEqual(["first", "second"]);
    expect(data.votes[0].choices.map((choice) => choice.slotId)).toEqual(
      sorted.map((slot) => slot.id),
    );
  });

  test("an unknown poll is an error without data", async () => {
    const res = await getPollById({ pollId: v4() });
    expect(res?.data).toBeUndefined();
    expect(res?.serverError).toBe(
      "Une erreur est survenue, veuillez réessayer plus tard",
    );
  });
});

describe("getPollsByEmail", () => {
  test("the polls of this email only, last created first, without their password", async () => {
    const first = await createPoll({
      email,
      title: `${TITLE} 1`,
      password: PASSWORD,
    });
    const second = await createPoll({ email, title: `${TITLE} 2` });
    await createPoll({ email: `other-${email}` });

    const res = await getPollsByEmail(email);
    expect(res?.data?.map((poll) => poll.id)).toEqual([second.id, first.id]);
    expect(Object.keys(res!.data![0]).sort()).toEqual([
      "createdAt",
      "id",
      "title",
    ]);
  });

  test("not an email: refused", async () => {
    const res = await getPollsByEmail("not-an-email");
    expect(res?.data).toBeUndefined();
    expect(res?.validationErrors).toBeDefined();
  });
});

describe("getPolls (admin)", () => {
  // only in the polls of this describe
  const search = v4().slice(0, 8);

  beforeEach(() => {
    adminSession.valid = true;
  });
  afterAll(() => {
    adminSession.valid = false;
  });

  beforeAll(async () => {
    await createPoll({
      title: `${TITLE} Tournoi ${search}`,
      description: "Le samedi",
    });
    await createPoll({
      title: `${TITLE} other ${search}`,
      description: `PING-${search}`,
    });
  });

  test("refused without the admin session, whatever the password", async () => {
    adminSession.valid = false;
    for (const password of ["", PASSWORD, ADMIN]) {
      const res = await getPolls({ password, query: search } as never);
      expect(res?.data, password).toBeUndefined();
      expect(res?.serverError, password).toBe(
        "Session expirée, reconnectez-vous",
      );
    }
  });

  test("searches titles and descriptions whatever the case, and pages", async () => {
    const titles = async (query: string, limit?: number, offset?: number) =>
      (await getPolls({ query, limit, offset }))?.data?.map(
        (poll) => poll.title,
      );

    expect(await titles(`tournoi ${search}`)).toEqual([
      `${TITLE} Tournoi ${search}`,
    ]);
    expect(await titles(`ping-${search}`)).toEqual([
      `${TITLE} other ${search}`,
    ]);
    expect(await titles(search)).toHaveLength(2);
    // last created first
    expect(await titles(search, 1)).toEqual([`${TITLE} other ${search}`]);
    expect(await titles(search, 1, 1)).toEqual([`${TITLE} Tournoi ${search}`]);
  });
});

describe("isPollPasswordValid", () => {
  test("true with the poll or the admin password, an error otherwise", async () => {
    const poll = await createPoll({ password: PASSWORD });
    expect(
      (await isPollPasswordValid({ pollId: poll.id, password: PASSWORD }))
        ?.data,
    ).toBe(true);
    expect(
      (await isPollPasswordValid({ pollId: poll.id, password: ADMIN }))?.data,
    ).toBe(true);

    const res = await isPollPasswordValid({
      pollId: poll.id,
      password: "wrong",
    });
    expect(res?.data).toBeUndefined();
    expect(res?.serverError).toBe("Mot de passe incorrect");
  });
});

describe("updatePoll", () => {
  test("changes the title and description, never the password", async () => {
    const poll = await createPoll({ password: PASSWORD });

    const res = await updatePoll({
      pollId: poll.id,
      password: PASSWORD,
      title: "integration test poll queries renamed",
      description: "New description",
    });
    expect(res?.data).toEqual({ success: true });

    const stored = await prisma.poll.findUniqueOrThrow({
      where: { id: poll.id },
    });
    expect(stored).toMatchObject({
      title: "integration test poll queries renamed",
      description: "New description",
      password: PASSWORD,
    });

    // with the admin password: the poll keeps its own
    await updatePoll({ pollId: poll.id, password: ADMIN, title: TITLE });
    expect(
      (await prisma.poll.findUniqueOrThrow({ where: { id: poll.id } }))
        .password,
    ).toBe(PASSWORD);
  });

  test("refused with a wrong password, or on a poll without password", async () => {
    const poll = await createPoll({ password: PASSWORD });
    const open = await createPoll();

    for (const [pollId, password] of [
      [poll.id, "wrong"],
      [open.id, ""],
    ]) {
      const res = await updatePoll({ pollId, password, title: "hacked" });
      expect(res?.serverError).toBe("Mot de passe incorrect");
    }
    expect(
      await prisma.poll.count({
        where: { id: { in: [poll.id, open.id] }, title: "hacked" },
      }),
    ).toBe(0);
  });

  test("an empty title is refused", async () => {
    const poll = await createPoll({ password: PASSWORD });
    const res = await updatePoll({
      pollId: poll.id,
      password: PASSWORD,
      title: "",
    });
    expect(res?.validationErrors).toBeDefined();
  });
});

describe("deletePoll", () => {
  test("with the poll password: the poll and all its data are deleted", async () => {
    const poll = await createPoll({ password: PASSWORD });
    const voteId = v4();
    await createVote({
      id: voteId,
      name: "A",
      pollId: poll.id,
      choices: poll.slots.map((slot) => ({
        id: v4(),
        slotId: slot.id,
        choice: 1,
      })),
    });
    await prisma.comment.create({
      data: { pollId: poll.id, author: "A", text: "Hi" },
    });

    const res = await deletePoll({ pollId: poll.id, password: PASSWORD });
    expect(res?.data).toEqual({ success: true });
    expect(await prisma.poll.count({ where: { id: poll.id } })).toBe(0);
    expect(await prisma.slot.count({ where: { pollId: poll.id } })).toBe(0);
    expect(await prisma.vote.count({ where: { id: voteId } })).toBe(0);
    expect(await prisma.voteChoice.count({ where: { voteId } })).toBe(0);
    expect(await prisma.comment.count({ where: { pollId: poll.id } })).toBe(0);
  });

  test("refused with the password of another poll", async () => {
    const poll = await createPoll({ password: PASSWORD });
    const other = await createPoll({ password: "other-password" });

    const res = await deletePoll({
      pollId: poll.id,
      password: "other-password",
    });
    expect(res?.serverError).toBe("Mot de passe incorrect");
    expect(
      await prisma.poll.count({ where: { id: { in: [poll.id, other.id] } } }),
    ).toBe(2);
  });

  test("the admin can delete any poll, a deleted poll can't be deleted again", async () => {
    const poll = await createPoll();
    expect(
      (await deletePoll({ pollId: poll.id, password: ADMIN }))?.data,
    ).toEqual({
      success: true,
    });
    // the admin password skips the poll lookup: the delete itself fails
    expect(
      (await deletePoll({ pollId: poll.id, password: ADMIN }))?.serverError,
    ).toBe("Une erreur est survenue, veuillez réessayer plus tard");
    expect(
      (await deletePoll({ pollId: poll.id, password: PASSWORD }))?.serverError,
    ).toBe("Ce sondage n'existe plus");
  });
});
