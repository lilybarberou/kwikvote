import { prisma } from "@/prisma/db";
import { afterAll, describe, expect, test, vi } from "vitest";

import { createPoll } from "./mutation";

// no Discord message
const discord = vi.hoisted(() => ({ calls: 0, fail: false }));
vi.mock("@/lib/utils.server", () => ({
  sendDiscordMessage: async () => {
    discord.calls++;
    if (discord.fail) throw new Error("Discord down");
  },
}));

const DAY = 24 * 60 * 60 * 1000;
const TITLE = "integration test createPoll";

const slots = () => {
  const start = Date.now() + 365 * DAY;
  return [0, 1].map((index) => ({
    startDate: new Date(start + index * DAY),
    endDate: new Date(start + index * DAY + 2 * 60 * 60 * 1000),
    maxParticipants: 2,
  }));
};

afterAll(async () => {
  await prisma.poll.deleteMany({ where: { title: TITLE } });
  await prisma.$disconnect();
});

describe("createPoll (local database)", () => {
  test("a registration poll gets a cron schedule for each slot, the first one included", async () => {
    const res = await createPoll({
      type: 2,
      title: TITLE,
      timeBeforeAllowedType: 2,
      msBeforeAllowed: 60 * 60 * 1000,
      slots: slots(),
    });
    expect(res?.serverError).toBeUndefined();

    const poll = await prisma.poll.findUniqueOrThrow({
      where: { id: res!.data! },
      include: { slots: true, cronSchedules: true },
    });
    expect(poll.cronSchedules.map((c) => c.slotId).sort()).toEqual(
      poll.slots.map((s) => s.id).sort(),
    );
  });

  test("a Discord failure doesn't fail the creation", async () => {
    discord.fail = true;
    const res = await createPoll({
      type: 1,
      title: TITLE,
      timeBeforeAllowedType: 1,
      msBeforeAllowed: 0,
      slots: slots(),
    });
    discord.fail = false;

    expect(res?.serverError).toBeUndefined();
    expect(await prisma.poll.count({ where: { id: res!.data! } })).toBe(1);
  });
});
