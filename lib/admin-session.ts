import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { env } from "./env";

// The admin signs in once with ADMIN_PASSWORD (a POST, never the URL) and
// gets a session cookie: httpOnly, signed with a key derived from the
// password (changing the password ends every session), valid 12 hours.

export const ADMIN_COOKIE = "kwikvote_admin";
export const ADMIN_SESSION_MS = 12 * 60 * 60 * 1000;

const digest = (value: string) => createHash("sha256").update(value).digest();

// constant time, whatever the lengths
const safeEqual = (a: string, b: string) =>
  timingSafeEqual(digest(a), digest(b));

const sign = (payload: string) =>
  createHmac("sha256", digest(`kwikvote-admin-session:${env.ADMIN_PASSWORD}`))
    .update(payload)
    .digest("base64url");

export const isAdminPassword = (password: string) =>
  safeEqual(password, env.ADMIN_PASSWORD);

export const createAdminSession = (now = Date.now()) => {
  const expires = now + ADMIN_SESSION_MS;
  const payload = `v1.${expires}`;
  return { value: `${payload}.${sign(payload)}`, expires: new Date(expires) };
};

export const isAdminSessionValid = (
  value: string | undefined,
  now = Date.now(),
) => {
  const [version, expires, signature, ...rest] = (value ?? "").split(".");
  if (version !== "v1" || !expires || !signature || rest.length) return false;
  if (!safeEqual(signature, sign(`${version}.${expires}`))) return false;
  return Number(expires) > now;
};
