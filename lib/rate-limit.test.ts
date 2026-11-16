import { describe, expect, test } from "vitest";

import {
  createRateLimiter,
  getClientIpFromHeaders,
  tooManyAttemptsMessage,
} from "./rate-limit";

const clock = () => {
  let time = 0;
  return { now: () => time, advance: (ms: number) => (time += ms) };
};

describe("rate limiter", () => {
  test("the limit per window, per key", () => {
    const { now, advance } = clock();
    const limiter = createRateLimiter({ limit: 3, windowMs: 1000, now });

    for (let i = 0; i < 3; i++) {
      expect(limiter.retryAfter("a")).toBe(0);
      limiter.hit("a");
    }
    expect(limiter.retryAfter("a")).toBe(1000);
    expect(limiter.retryAfter("b")).toBe(0);

    advance(400);
    expect(limiter.retryAfter("a")).toBe(600);
    advance(600);
    // a new window
    expect(limiter.retryAfter("a")).toBe(0);
    limiter.hit("a");
    expect(limiter.retryAfter("a")).toBe(0);
  });

  test("checking doesn't count, only hits do", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1000 });
    for (let i = 0; i < 5; i++) expect(limiter.retryAfter("a")).toBe(0);
    limiter.hit("a");
    expect(limiter.retryAfter("a")).toBeGreaterThan(0);
  });

  test("a bounded memory: the oldest keys are forgotten first", () => {
    const { now } = clock();
    const limiter = createRateLimiter({
      limit: 1,
      windowMs: 1000,
      maxKeys: 2,
      now,
    });
    limiter.hit("a");
    limiter.hit("b");
    limiter.hit("c");
    expect(limiter.retryAfter("a")).toBe(0);
    expect(limiter.retryAfter("b")).toBe(1000);
    expect(limiter.retryAfter("c")).toBe(1000);
  });

  test("the message gives the minutes to wait", () => {
    expect(tooManyAttemptsMessage(1)).toBe(
      "Trop d'essais, réessayez dans 1 minute",
    );
    expect(tooManyAttemptsMessage(14 * 60_000 + 1)).toBe(
      "Trop d'essais, réessayez dans 15 minutes",
    );
  });
});

describe("address of the visitor", () => {
  const ip = (headers: Record<string, string>) =>
    getClientIpFromHeaders(new Headers(headers));

  test("X-Real-IP, else the last address of X-Forwarded-For", () => {
    expect(ip({ "x-real-ip": "203.0.113.7" })).toBe("203.0.113.7");
    expect(
      ip({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.1" }),
    ).toBe("203.0.113.7");
    // the first addresses can be written by the visitor
    expect(ip({ "x-forwarded-for": "1.2.3.4, 198.51.100.1" })).toBe(
      "198.51.100.1",
    );
    expect(ip({ "x-forwarded-for": " 198.51.100.1 " })).toBe("198.51.100.1");
    expect(ip({})).toBe("unknown");
  });
});
