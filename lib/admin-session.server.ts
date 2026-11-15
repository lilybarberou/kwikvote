import { cookies } from "next/headers";
import "server-only";

import {
  ADMIN_COOKIE,
  createAdminSession,
  isAdminSessionValid,
} from "./admin-session";
import { env } from "./env";

// the session cookie of the admin, read and written in the requests only

export const hasAdminSession = async () =>
  isAdminSessionValid((await cookies()).get(ADMIN_COOKIE)?.value);

export const startAdminSession = async () => {
  const session = createAdminSession();
  (await cookies()).set(ADMIN_COOKIE, session.value, {
    httpOnly: true,
    // https in production; the local http tests need it off
    secure: env.DOMAIN.startsWith("https://"),
    // lax: still sent when the admin page is opened from a link
    sameSite: "lax",
    path: "/",
    expires: session.expires,
  });
};

export const endAdminSession = async () => {
  (await cookies()).delete(ADMIN_COOKIE);
};
