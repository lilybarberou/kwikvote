import { describe, expect, test, vi } from "vitest";

import {
  ADMIN_SESSION_MS,
  createAdminSession,
  isAdminPassword,
  isAdminSessionValid,
} from "./admin-session";

const env = vi.hoisted(() => ({ ADMIN_PASSWORD: "admin-secret" }));
vi.mock("@/lib/env", () => ({ env }));

describe("admin password", () => {
  test("exactly the admin password", () => {
    expect(isAdminPassword("admin-secret")).toBe(true);
    for (const password of ["", "admin", "ADMIN-SECRET", "admin-secret "])
      expect(isAdminPassword(password), password).toBe(false);
  });
});

describe("admin session", () => {
  const now = Date.UTC(2026, 10, 15, 12);

  test("valid for 12 hours", () => {
    const session = createAdminSession(now);
    expect(session.expires.getTime()).toBe(now + ADMIN_SESSION_MS);
    expect(isAdminSessionValid(session.value, now)).toBe(true);
    expect(isAdminSessionValid(session.value, now + ADMIN_SESSION_MS - 1)).toBe(
      true,
    );
    expect(isAdminSessionValid(session.value, now + ADMIN_SESSION_MS)).toBe(
      false,
    );
  });

  test("neither the password nor anything forged", () => {
    const { value } = createAdminSession(now);
    const [version, expires, signature] = value.split(".");
    expect(value).not.toContain("admin-secret");

    for (const forged of [
      undefined,
      "",
      "admin-secret",
      `${version}.${expires}`,
      // a later expiry with the same signature
      `${version}.${Number(expires) + ADMIN_SESSION_MS}.${signature}`,
      `${version}.${expires}.${signature.slice(0, -2)}AA`,
      `v2.${expires}.${signature}`,
      `${value}.extra`,
    ])
      expect(isAdminSessionValid(forged, now), String(forged)).toBe(false);
  });

  test("a new admin password ends the sessions", () => {
    const { value } = createAdminSession(now);
    env.ADMIN_PASSWORD = "new-secret";
    try {
      expect(isAdminSessionValid(value, now)).toBe(false);
    } finally {
      env.ADMIN_PASSWORD = "admin-secret";
    }
    expect(isAdminSessionValid(value, now)).toBe(true);
  });
});
