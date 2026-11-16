// Fixed window counters kept in the memory of the server process: enough for
// the single instance kwikvote runs on. They are reset by a restart (deploy),
// and each instance would count on its own if there were several.

export type RateLimit = {
  // attempts allowed per window
  limit: number;
  windowMs: number;
};

type Window = { count: number; resetAt: number };

export const createRateLimiter = ({
  limit,
  windowMs,
  maxKeys = 10_000,
  now = Date.now,
}: RateLimit & { maxKeys?: number; now?: () => number }) => {
  const windows = new Map<string, Window>();

  const current = (key: string) => {
    const time = now();
    const window = windows.get(key);
    if (window && window.resetAt > time) return window;
    windows.delete(key);
    return undefined;
  };

  return {
    // ms to wait before the next attempt, 0 if it is allowed (not counted)
    retryAfter: (key: string) => {
      const window = current(key);
      return window && window.count >= limit ? window.resetAt - now() : 0;
    },
    // counts an attempt (or a failure, for the passwords)
    hit: (key: string) => {
      const window = current(key) ?? { count: 0, resetAt: now() + windowMs };
      window.count++;
      // the oldest keys go first when there are too many (Map keeps the order)
      windows.delete(key);
      windows.set(key, window);
      if (windows.size > maxKeys) windows.delete(windows.keys().next().value!);
    },
    reset: () => windows.clear(),
  };
};

export type RateLimiter = ReturnType<typeof createRateLimiter>;

export const tooManyAttemptsMessage = (retryAfterMs: number) => {
  const minutes = Math.max(1, Math.ceil(retryAfterMs / 60_000));
  return `Trop d'essais, réessayez dans ${minutes} minute${minutes > 1 ? "s" : ""}`;
};

// The address of the visitor, as the reverse proxy gives it: X-Real-IP, or
// the last address of X-Forwarded-For (the one the proxy added itself; the
// first ones can be written by the visitor).
export const getClientIpFromHeaders = (headers: Headers) => {
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((ip) => ip.trim())
    .filter(Boolean);
  return forwarded?.at(-1) ?? "unknown";
};
