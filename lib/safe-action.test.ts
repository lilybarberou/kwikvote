import { Prisma } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { z } from "zod";

import { ActionError, action, adminAction, pollPwAction } from "./safe-action";

vi.mock("@/lib/env", () => ({ env: { ADMIN_PASSWORD: "admin-secret" } }));

// the stored password of each poll
const polls = vi.hoisted(() => new Map<string, string>());
const findFirst = vi.hoisted(() => vi.fn());
vi.mock("@/prisma/db", () => ({
  prisma: {
    poll: {
      findFirst: findFirst.mockImplementation(
        async ({ where }: { where: { id: string } }) =>
          polls.has(where.id) ? { password: polls.get(where.id) } : null,
      ),
    },
  },
}));

const errors = vi.spyOn(console, "error").mockImplementation(() => {});
afterAll(() => errors.mockRestore());

beforeEach(() => {
  polls.clear();
  findFirst.mockClear();
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

  test("only with the admin password", async () => {
    expect((await getSecret({ password: "admin-secret" }))?.data).toBe(
      "secret data",
    );

    for (const password of ["wrong", "", "ADMIN-SECRET", "admin-secret "]) {
      const res = await getSecret({ password });
      expect(res?.data, password).toBeUndefined();
      expect(res?.serverError, password).toBe("Mot de passe incorrect");
    }
  });

  test("without password: refused", async () => {
    const res = await getSecret({} as never);
    expect(res?.data).toBeUndefined();
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
