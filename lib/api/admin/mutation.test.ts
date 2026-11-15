import { isAdminSessionValid } from "@/lib/admin-session";
import { limiters } from "@/lib/rate-limits.server";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";

import { adminSignIn, adminSignOut } from "./mutation";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  env: { ADMIN_PASSWORD: "admin-secret", DOMAIN: "https://kwikvote.app" },
}));
vi.mock("@/prisma/db", () => ({ prisma: {} }));

// the cookies and the address of the request (next/headers)
const jar = vi.hoisted(
  () => new Map<string, { value: string; [option: string]: unknown }>(),
);
const clientIp = vi.hoisted(() => ({ value: "203.0.113.1" }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-real-ip": clientIp.value }),
  cookies: async () => ({
    get: (name: string) => jar.get(name),
    set: (name: string, value: string, options: object) =>
      jar.set(name, { value, ...options }),
    delete: (name: string) => jar.delete(name),
  }),
}));

const errors = vi.spyOn(console, "error").mockImplementation(() => {});
afterAll(() => errors.mockRestore());
beforeEach(() => {
  jar.clear();
  Object.values(limiters).forEach((limiter) => limiter.reset());
  clientIp.value = "203.0.113.1";
});

describe("admin sign in (cookies of the request)", () => {
  test("the right password: an httpOnly session cookie, never the password", async () => {
    const res = await adminSignIn({ password: "admin-secret" });
    expect(res?.data).toEqual({ success: true });

    const cookie = jar.get("kwikvote_admin")!;
    expect(cookie).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });
    expect(cookie.value).not.toContain("admin-secret");
    expect(isAdminSessionValid(cookie.value)).toBe(true);
    const hours = ((cookie.expires as Date).getTime() - Date.now()) / 3600e3;
    expect(hours).toBeGreaterThan(11.9);
    expect(hours).toBeLessThanOrEqual(12);
  });

  test("a wrong password: no cookie, a message", async () => {
    for (const password of ["", "wrong", "ADMIN-SECRET"]) {
      const res = await adminSignIn({ password });
      expect(res?.serverError, password).toBe("Mot de passe incorrect");
    }
    expect(jar.size).toBe(0);
  });

  test("signing out removes the cookie", async () => {
    await adminSignIn({ password: "admin-secret" });
    expect(jar.has("kwikvote_admin")).toBe(true);
    await adminSignOut();
    expect(jar.has("kwikvote_admin")).toBe(false);
  });
});

describe("rate limits of the admin password", () => {
  const TOO_MANY = /^Trop d'essais, réessayez dans 15 minutes$/;

  test("5 failures per address, then even the right password is refused", async () => {
    for (let i = 0; i < 5; i++)
      expect((await adminSignIn({ password: "wrong" }))?.serverError).toBe(
        "Mot de passe incorrect",
      );
    expect(
      (await adminSignIn({ password: "admin-secret" }))?.serverError,
    ).toMatch(TOO_MANY);
    expect(jar.size).toBe(0);

    // another address
    clientIp.value = "203.0.113.2";
    expect((await adminSignIn({ password: "admin-secret" }))?.data).toEqual({
      success: true,
    });
  });

  test("30 failures from any addresses block everyone", async () => {
    for (let i = 0; i < 30; i++) {
      clientIp.value = `198.51.100.${i}`;
      await adminSignIn({ password: "wrong" });
    }
    clientIp.value = "203.0.113.9";
    expect(
      (await adminSignIn({ password: "admin-secret" }))?.serverError,
    ).toMatch(TOO_MANY);
  });
});
