import { afterEach, describe, expect, test, vi } from "vitest";

import { sendDiscordMessage } from "./utils.server";

vi.mock("@/lib/env", () => ({
  env: { DISCORD_WEBHOOK_URL: "https://discord.invalid/webhook" },
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sendDiscordMessage", () => {
  test("posts an embed to the webhook", async () => {
    // no network: the webhook is a fake
    const fetch = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);

    await sendDiscordMessage({
      title: 'Nouveau sondage "Foot"',
      description: "alice@example.invalid",
      fields: [{ name: "Lien", value: "https://kwikvote.test/poll/1" }],
    });

    expect(fetch).toHaveBeenCalledWith("https://discord.invalid/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [
          {
            title: 'Nouveau sondage "Foot"',
            description: "alice@example.invalid",
            fields: [{ name: "Lien", value: "https://kwikvote.test/poll/1" }],
          },
        ],
      }),
    });
  });

  test("a refused message is an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("rate limited", { status: 429 })),
    );
    await expect(sendDiscordMessage({ title: "x" })).rejects.toThrow(
      "Discord webhook failed: 429",
    );
  });
});
