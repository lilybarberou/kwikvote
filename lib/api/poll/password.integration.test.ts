import { verifyPollPassword } from "@/lib/poll-password.mjs";
import { prisma } from "@/prisma/db";
import { afterAll, describe, expect, test, vi } from "vitest";

import { hashPlainPollPasswords } from "../../../scripts/hash-poll-passwords.mjs";
import { createPoll } from "./mutation";
import { getPolls, isPollPasswordValid } from "./query";

// The poll passwords are stored hashed (lib/poll-password.mjs); the ones of
// the polls created before are hashed at their first sign in, or by
// scripts/hash-poll-passwords.mjs.

vi.mock("@/lib/utils.server", () => ({ sendDiscordMessage: async () => {} }));
// the admin session cookie of the request (lib/admin-session.server.ts),
// signed in for the admin list only
const adminSession = vi.hoisted(() => ({ valid: false }));
vi.mock("@/lib/admin-session.server", () => ({
  hasAdminSession: async () => adminSession.valid,
}));
const errors = vi.spyOn(console, "error").mockImplementation(() => {});

const TITLE = "integration test poll passwords";
const DAY = 24 * 60 * 60 * 1000;

const stored = async (id: string) =>
  (await prisma.poll.findUniqueOrThrow({ where: { id } })).password;

// a poll as the previous versions stored it: its password in clear
const oldPoll = (password: string) =>
  prisma.poll.create({ data: { title: TITLE, password } });

afterAll(async () => {
  errors.mockRestore();
  await prisma.poll.deleteMany({ where: { title: TITLE } });
  await prisma.$disconnect();
});

describe("poll passwords (local database)", () => {
  test("a new poll stores its password hashed, it still opens the settings", async () => {
    const start = new Date(Date.now() + 30 * DAY);
    const res = await createPoll({
      type: 1,
      title: TITLE,
      password: "secret-auteur",
      timeBeforeAllowedType: 1,
      msBeforeAllowed: 0,
      slots: [
        {
          startDate: start,
          endDate: new Date(start.getTime() + 3600e3),
          maxParticipants: 1,
        },
      ],
    });
    expect(res?.serverError ?? res?.validationErrors).toBeUndefined();
    const id = res!.data!;

    const password = await stored(id);
    expect(password).toMatch(/^scrypt\$/);
    expect(password).not.toContain("secret-auteur");
    expect(
      (await isPollPasswordValid({ pollId: id, password: "secret-auteur" }))
        ?.data,
    ).toBe(true);
    expect(
      (await isPollPasswordValid({ pollId: id, password: "secret" }))
        ?.serverError,
    ).toBe("Mot de passe incorrect");
  });

  test("without password, nothing is stored", async () => {
    const start = new Date(Date.now() + 30 * DAY);
    const res = await createPoll({
      type: 1,
      title: TITLE,
      timeBeforeAllowedType: 1,
      msBeforeAllowed: 0,
      slots: [
        {
          startDate: start,
          endDate: new Date(start.getTime() + 3600e3),
          maxParticipants: 1,
        },
      ],
    });
    expect(await stored(res!.data!)).toBe("");
  });

  test("a poll created before: its password in clear opens it once, then is hashed", async () => {
    const poll = await oldPoll("ancien-mdp");

    await isPollPasswordValid({ pollId: poll.id, password: "faux" });
    expect(await stored(poll.id)).toBe("ancien-mdp");

    expect(
      (await isPollPasswordValid({ pollId: poll.id, password: "ancien-mdp" }))
        ?.data,
    ).toBe(true);
    const hashed = await stored(poll.id);
    expect(hashed).toMatch(/^scrypt\$/);
    expect(await verifyPollPassword(hashed, "ancien-mdp")).toBe(true);
    expect(
      (await isPollPasswordValid({ pollId: poll.id, password: "ancien-mdp" }))
        ?.data,
    ).toBe(true);
  });

  test("the admin list never sends a password, even hashed", async () => {
    const poll = await oldPoll("visible ?");
    adminSession.valid = true;
    const res = await getPolls({ query: "", limit: 50 });
    adminSession.valid = false;
    const listed = res?.data?.find((p) => p.id === poll.id);
    expect(listed).toBeDefined();
    expect(listed).not.toHaveProperty("password");
  });
});

describe("scripts/hash-poll-passwords.mjs (local database)", () => {
  test("the dry run counts, --apply hashes the passwords in clear, once", async () => {
    // the other polls of the base are counted too: compare the differences
    const before = await hashPlainPollPasswords(prisma);
    const old = [await oldPoll("un"), await oldPoll("deux")];
    const empty = await oldPoll("");
    const recent = await oldPoll("trois");
    await isPollPasswordValid({ pollId: recent.id, password: "trois" });

    const dryRun = await hashPlainPollPasswords(prisma);
    expect(dryRun).toEqual({ inClear: before.inClear + 2, hashed: 0 });
    expect(await stored(old[0].id)).toBe("un");

    const applied = await hashPlainPollPasswords(prisma, { apply: true });
    expect(applied).toEqual({
      inClear: before.inClear + 2,
      hashed: before.inClear + 2,
    });
    expect(await verifyPollPassword(await stored(old[0].id), "un")).toBe(true);
    expect(await verifyPollPassword(await stored(old[1].id), "deux")).toBe(
      true,
    );
    expect(await stored(empty.id)).toBe("");

    expect(await hashPlainPollPasswords(prisma, { apply: true })).toEqual({
      inClear: 0,
      hashed: 0,
    });
  });
});
