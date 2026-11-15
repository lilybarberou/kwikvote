import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";

import { hashSubscriptionEndpoint } from "./subscription-hash";

// the hash computed by node:crypto, the reference
const nodeHash = (pollId: string, endpoint: string) =>
  createHash("sha256").update(`${pollId}:${endpoint}`).digest("base64url");

describe("hashSubscriptionEndpoint", () => {
  test("the same as node:crypto: SHA-256 of pollId:endpoint in base64url", async () => {
    const cases = [
      ["2f6c1a0e-5b8f-4c1e-9a43-0d5e8e7f1b2c", "https://push.invalid/abc"],
      [
        "poll",
        "https://fcm.googleapis.com/fcm/send/dQw4w9WgXcQ:APA91bH-very_long+token/with=chars",
      ],
      ["", ""],
      ["sondage-éàü", "https://push.invalid/ünïcødé/🔔"],
    ];
    // enough random inputs to meet every base64url character and padding
    for (let i = 0; i < 200; i++)
      cases.push([
        crypto.randomUUID(),
        `https://push.invalid/${Math.random()}`,
      ]);

    for (const [pollId, endpoint] of cases)
      expect(await hashSubscriptionEndpoint(pollId, endpoint)).toBe(
        nodeHash(pollId, endpoint),
      );
  });

  test("another hash in each poll, never the endpoint itself", async () => {
    const endpoint = "https://push.invalid/browser";
    const first = await hashSubscriptionEndpoint("poll-1", endpoint);
    const second = await hashSubscriptionEndpoint("poll-2", endpoint);

    expect(first).not.toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first).not.toContain("push.invalid");
  });
});
