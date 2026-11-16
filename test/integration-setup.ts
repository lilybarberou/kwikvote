import { randomUUID } from "node:crypto";
import { vi } from "vitest";

// the .env of the project can point to a remote (production) database:
// these tests write and delete data, they only run on a local one
const url = process.env.DATABASE_URL;
const host = url ? new URL(url).hostname : "";

if (!["localhost", "127.0.0.1", "::1"].includes(host))
  throw new Error(
    `Integration tests need a local DATABASE_URL, got host "${host || "none"}"`,
  );

// no request, so no cookies, in these tests: nobody is signed in as admin,
// unless a test mocks it otherwise (lib/admin-session.server.ts)
vi.mock("@/lib/admin-session.server", () => ({
  hasAdminSession: async () => false,
  startAdminSession: async () => {},
  endAdminSession: async () => {},
}));

// no request in these tests: the address of the visitor, for the rate limits
// (lib/rate-limits.server.ts), is a new one at each call unless a test sets
// it (setClientIp of test/client-ip.ts)
vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({
      "x-real-ip":
        (globalThis as { __clientIp?: string }).__clientIp ?? randomUUID(),
    }),
}));
