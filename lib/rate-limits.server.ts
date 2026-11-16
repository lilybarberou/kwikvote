import { headers } from "next/headers";
import "server-only";

import {
  RateLimiter,
  createRateLimiter,
  getClientIpFromHeaders,
  tooManyAttemptsMessage,
} from "./rate-limit";

const MINUTE = 60_000;

// The limits of the actions anyone can call. The password
// ones only count the failures: the right password is refused too once a
// limit is reached, or the guessing would go on until it succeeds.
export const limiters = {
  // admin password: per address, and for everyone (rotating addresses)
  adminFailuresByIp: createRateLimiter({ limit: 5, windowMs: 15 * MINUTE }),
  adminFailures: createRateLimiter({ limit: 30, windowMs: 15 * MINUTE }),
  // password of a poll: per address and poll, and per poll
  pollPasswordFailuresByIp: createRateLimiter({
    limit: 10,
    windowMs: 15 * MINUTE,
  }),
  pollPasswordFailures: createRateLimiter({ limit: 30, windowMs: 15 * MINUTE }),
  // polls of an email (no verification of the email: slows the scraping)
  emailSearchesByIp: createRateLimiter({ limit: 20, windowMs: 10 * MINUTE }),
  // comments notify every subscriber of the poll
  commentsByIpAndPoll: createRateLimiter({ limit: 10, windowMs: 10 * MINUTE }),
  commentsByIp: createRateLimiter({ limit: 60, windowMs: 60 * MINUTE }),
  commentsByPoll: createRateLimiter({ limit: 100, windowMs: 60 * MINUTE }),
};

// [limiter, key] pairs checked and counted together
export type LimitChecks = [RateLimiter, string][];

export const getClientIp = async () => getClientIpFromHeaders(await headers());

// the message of the refusal while one of the limits is reached, or undefined
export const getLimitMessage = (checks: LimitChecks) => {
  const retryAfter = Math.max(
    ...checks.map(([limiter, key]) => limiter.retryAfter(key)),
  );
  return retryAfter > 0 ? tooManyAttemptsMessage(retryAfter) : undefined;
};

export const hitAll = (checks: LimitChecks) =>
  checks.forEach(([limiter, key]) => limiter.hit(key));
