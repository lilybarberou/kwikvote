// The password of a poll is stored hashed with scrypt (node:crypto), salted:
// "scrypt$<N>$<r>$<p>$<salt>$<key>", base64url. The polls created before
// still hold their password in clear: it is checked as such, and hashed at the
// first successful sign in (lib/safe-action.ts) or by
// scripts/hash-poll-passwords.mjs.
// Plain JavaScript: shared by the app and that script, which runs with node.
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const PREFIX = "scrypt$";
const COST = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 32;

/** @returns {Promise<Buffer>} */
const derive = (
  /** @type {string} */ password,
  /** @type {Buffer} */ salt,
  /** @type {number} */ length,
  /** @type {{ N: number, r: number, p: number }} */ cost,
) =>
  new Promise((resolve, reject) =>
    scrypt(password, salt, length, cost, (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );

/** @param {string} stored */
export const isHashedPassword = (stored) => stored.startsWith(PREFIX);

/** @param {string} password */
export const hashPollPassword = async (password) => {
  const salt = randomBytes(16);
  const key = await derive(password, salt, KEY_LENGTH, COST);
  return [
    "scrypt",
    COST.N,
    COST.r,
    COST.p,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$");
};

/**
 * The password typed against the stored one (hashed, or in clear for the
 * polls created before), in constant time. A poll without password has none.
 * @param {string} stored
 * @param {string | undefined} password
 */
export const verifyPollPassword = async (stored, password) => {
  if (!stored || !password) return false;

  if (!isHashedPassword(stored)) {
    const digest = (/** @type {string} */ value) =>
      createHash("sha256").update(value).digest();
    return timingSafeEqual(digest(stored), digest(password));
  }

  const [N, r, p, salt, key] = stored.slice(PREFIX.length).split("$");
  const expected = Buffer.from(key ?? "", "base64url");
  if (!salt || !expected.length) return false;
  const actual = await derive(
    password,
    Buffer.from(salt, "base64url"),
    expected.length,
    { N: Number(N), r: Number(r), p: Number(p) },
  );
  return timingSafeEqual(actual, expected);
};
