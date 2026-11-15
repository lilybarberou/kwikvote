import { Prisma } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";

import { hashPollPassword, verifyPollPassword } from "./poll-password.mjs";
import { limiters } from "./rate-limits.server";
import { ActionError, action, adminAction, pollPwAction } from "./safe-action";

vi.mock("@/lib/env", () => ({ env: { ADMIN_PASSWORD: "admin-secret" } }));

// the admin session cookie of the request (lib/admin-session.server.ts)
const adminSession = vi.hoisted(() => ({ valid: false }));
vi.mock("@/lib/admin-session.server", () => ({
  hasAdminSession: async () => adminSession.valid,
}));

// the address of the visitor, for the rate limits (lib/rate-limits.server.ts)
const clientIp = vi.hoisted(() => ({ value: "203.0.113.1" }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-real-ip": clientIp.value }),
}));

// the stored password of each poll
const polls = vi.hoisted(() => new Map<string, string>());
const findFirst = vi.hoisted(() => vi.fn());
// the password in clear of a poll created before is hashed at its first sign in
const updateMany = vi.hoisted(() => vi.fn());
vi.mock("@/prisma/db", () => ({
  prisma: {
    poll: {
      findFirst: findFirst.mockImplementation(
        async ({ where }: { where: { id: string } }) =>
          polls.has(where.id) ? { password: polls.get(where.id) } : null,
      ),
      updateMany: updateMany.mockImplementation(
        async ({
          where,
          data,
        }: {
          where: { id: string; password: string };
          data: { password: string };
        }) => {
          if (polls.get(where.id) !== where.password) return { count: 0 };
          polls.set(where.id, data.password);
          return { count: 1 };
        },
      ),
    },
  },
}));

const errors = vi.spyOn(console, "error").mockImplementation(() => {});
afterAll(() => errors.mockRestore());

beforeEach(() => {
  adminSession.valid = false;
  Object.values(limiters).forEach((limiter) => limiter.reset());
  clientIp.value = "203.0.113.1";
  polls.clear();
  findFirst.mockClear();
  updateMany.mockClear();
});

describe("action errors", () => {
  const failing = (error: unknown) =>
    action.schema(z.object({})).action(async () => {
      throw error;
    });

  test("an ActionError message is shown to the user", async () => {
    const res = await failing(new ActionError("Ce vote a déjà été supprimé"))(
      {},
    );
    expect(res?.serverError).toBe("Ce vote a déjà été supprimé");
  });

  test("other errors are hidden", async () => {
    const res = await failing(
      new Error('relation "Poll" does not exist, password=...'),
    )({});
    expect(res?.serverError).toBe(
      "Une erreur est survenue, veuillez réessayer plus tard",
    );
  });

  test("a locked poll (lock or transaction timeout) asks to try again", async () => {
    const prismaError = (code: string, meta?: Record<string, unknown>) =>
      new Prisma.PrismaClientKnownRequestError("busy", {
        code,
        clientVersion: "5",
        meta,
      });
    const busy = "Le sondage est très sollicité, réessayez dans un instant";

    expect((await failing(prismaError("P2028"))({}))?.serverError).toBe(busy);
    expect(
      (await failing(prismaError("P2010", { code: "55P03" }))({}))?.serverError,
    ).toBe(busy);
    // another raw query error
    expect(
      (await failing(prismaError("P2010", { code: "23505" }))({}))?.serverError,
    ).toBe("Une erreur est survenue, veuillez réessayer plus tard");
  });

  test("invalid input is a validation error, the action doesn't run", async () => {
    const run = vi.fn();
    const res = await action
      .schema(z.object({ name: z.string().max(3) }))
      .action(async () => run())({ name: "too long" });
    expect(res?.validationErrors).toBeDefined();
    expect(run).not.toHaveBeenCalled();
  });
});

describe("adminAction", () => {
  const getSecret = adminAction.action(async () => "secret data");

  test("only with the admin session, never with a password", async () => {
    for (const input of [{}, { password: "admin-secret" }] as never[]) {
      const res = await getSecret(input);
      expect(res?.data).toBeUndefined();
      expect(res?.serverError).toBe("Session expirée, reconnectez-vous");
    }

    adminSession.valid = true;
    expect((await getSecret({}))?.data).toBe("secret data");
  });
});

describe("pollPwAction", () => {
  const manage = pollPwAction.action(
    async ({ parsedInput: { pollId } }) => `managed ${pollId}`,
  );

  test("the poll password manages this poll only", async () => {
    polls.set("poll-1", "pw-1");
    polls.set("poll-2", "pw-2");

    expect((await manage({ pollId: "poll-1", password: "pw-1" }))?.data).toBe(
      "managed poll-1",
    );
    const res = await manage({ pollId: "poll-2", password: "pw-1" });
    expect(res?.data).toBeUndefined();
    expect(res?.serverError).toBe("Mot de passe incorrect");
  });

  test("the admin password manages every poll, without reading it", async () => {
    polls.set("poll-1", "pw-1");
    expect(
      (await manage({ pollId: "poll-1", password: "admin-secret" }))?.data,
    ).toBe("managed poll-1");
    expect(findFirst).not.toHaveBeenCalled();
  });

  test("the admin session manages every poll, without reading it", async () => {
    polls.set("poll-1", "pw-1");
    adminSession.valid = true;
    expect((await manage({ pollId: "poll-1", password: "" }))?.data).toBe(
      "managed poll-1",
    );
    expect(findFirst).not.toHaveBeenCalled();
  });

  test("a poll created without password can't be managed, even with an empty one", async () => {
    polls.set("open", "");
    for (const password of ["", "anything"]) {
      const res = await manage({ pollId: "open", password });
      expect(res?.data, password).toBeUndefined();
      expect(res?.serverError, password).toBe("Mot de passe incorrect");
    }
  });

  test("an unknown poll", async () => {
    const res = await manage({ pollId: "gone", password: "pw" });
    expect(res?.serverError).toBe("Ce sondage n'existe plus");
  });

  test("a wrong password, or one of another case", async () => {
    polls.set("poll-1", "Secret");
    for (const password of ["secret", "Secret ", "Secre"]) {
      const res = await manage({ pollId: "poll-1", password });
      expect(res?.serverError, password).toBe("Mot de passe incorrect");
    }
  });

  test("a hashed password: checked, never stored again", async () => {
    polls.set("poll-1", await hashPollPassword("pw-1"));
    const stored = polls.get("poll-1");

    expect((await manage({ pollId: "poll-1", password: "pw-1" }))?.data).toBe(
      "managed poll-1",
    );
    for (const password of ["pw-2", "", stored!]) {
      const res = await manage({ pollId: "poll-1", password });
      expect(res?.serverError, password).toBe("Mot de passe incorrect");
    }
    expect(updateMany).not.toHaveBeenCalled();
  });

  test("a password in clear (poll created before): hashed at the first sign in only", async () => {
    polls.set("poll-1", "pw-1");

    // a wrong password changes nothing
    await manage({ pollId: "poll-1", password: "wrong" });
    expect(polls.get("poll-1")).toBe("pw-1");

    expect((await manage({ pollId: "poll-1", password: "pw-1" }))?.data).toBe(
      "managed poll-1",
    );
    const hashed = polls.get("poll-1")!;
    expect(hashed).toMatch(/^scrypt\$16384\$8\$1\$[\w-]{22}\$[\w-]{43}$/);
    expect(await verifyPollPassword(hashed, "pw-1")).toBe(true);

    // still the same password, now hashed
    expect((await manage({ pollId: "poll-1", password: "pw-1" }))?.data).toBe(
      "managed poll-1",
    );
    expect(updateMany).toHaveBeenCalledTimes(1);
  });

  test("the extended schemas keep the password check", async () => {
    const deleteSlot = pollPwAction
      .schema(async (s) => s.extend({ slotId: z.string() }))
      .action(async ({ parsedInput: { slotId } }) => `deleted ${slotId}`);
    polls.set("poll-1", "pw-1");

    expect(
      (await deleteSlot({ pollId: "poll-1", password: "pw-1", slotId: "s" }))
        ?.data,
    ).toBe("deleted s");
    expect(
      (await deleteSlot({ pollId: "poll-1", password: "nope", slotId: "s" }))
        ?.serverError,
    ).toBe("Mot de passe incorrect");
  });
});

describe("rate limits of the passwords", () => {
  const manage = pollPwAction.action(
    async ({ parsedInput: { pollId } }) => `managed ${pollId}`,
  );
  const TOO_MANY = /^Trop d'essais, réessayez dans 15 minutes$/;

  test("a poll: 10 failures per address, 30 for everyone, the other polls unchanged", async () => {
    polls.set("poll-1", "pw-1");
    polls.set("poll-2", "pw-2");
    for (let i = 0; i < 10; i++)
      await manage({ pollId: "poll-1", password: "wrong" });
    expect(
      (await manage({ pollId: "poll-1", password: "pw-1" }))?.serverError,
    ).toMatch(TOO_MANY);
    expect((await manage({ pollId: "poll-2", password: "pw-2" }))?.data).toBe(
      "managed poll-2",
    );

    // two more addresses: 30 failures on poll-1
    for (const ip of ["203.0.113.2", "203.0.113.3"]) {
      clientIp.value = ip;
      for (let i = 0; i < 10; i++)
        await manage({ pollId: "poll-1", password: "wrong" });
    }
    clientIp.value = "203.0.113.4";
    expect(
      (await manage({ pollId: "poll-1", password: "pw-1" }))?.serverError,
    ).toMatch(TOO_MANY);
  });

  test("the successes are not counted", async () => {
    polls.set("poll-1", "pw-1");
    for (let i = 0; i < 20; i++)
      expect((await manage({ pollId: "poll-1", password: "pw-1" }))?.data).toBe(
        "managed poll-1",
      );
  });
});
