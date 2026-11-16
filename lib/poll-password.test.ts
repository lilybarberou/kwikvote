import { describe, expect, test } from "vitest";

import {
  hashPollPassword,
  isHashedPassword,
  verifyPollPassword,
} from "./poll-password.mjs";

describe("poll passwords", () => {
  test("hashed with scrypt and a random salt, never in clear", async () => {
    const first = await hashPollPassword("mot de passe");
    const second = await hashPollPassword("mot de passe");

    expect(first).toMatch(/^scrypt\$16384\$8\$1\$[\w-]{22}\$[\w-]{43}$/);
    expect(first).not.toBe(second);
    expect(first).not.toContain("mot de passe");
    expect(isHashedPassword(first)).toBe(true);
  });

  test("only the right password matches a hash", async () => {
    const stored = await hashPollPassword("Secret é 🔒");

    expect(await verifyPollPassword(stored, "Secret é 🔒")).toBe(true);
    for (const password of ["secret é 🔒", "Secret é", "", undefined, stored])
      expect(await verifyPollPassword(stored, password), String(password)).toBe(
        false,
      );
  });

  test("a password in clear (poll created before) still matches", async () => {
    expect(isHashedPassword("pw-1")).toBe(false);
    expect(await verifyPollPassword("pw-1", "pw-1")).toBe(true);
    expect(await verifyPollPassword("pw-1", "pw-2")).toBe(false);
    expect(await verifyPollPassword("pw-1", "pw-1 ")).toBe(false);
  });

  test("a poll without password, or a broken hash, matches nothing", async () => {
    expect(await verifyPollPassword("", "")).toBe(false);
    expect(await verifyPollPassword("", "anything")).toBe(false);
    expect(await verifyPollPassword("scrypt$", "anything")).toBe(false);
    expect(await verifyPollPassword("scrypt$16384$8$1$$", "x")).toBe(false);
  });
});
