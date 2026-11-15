"use server";

import { isAdminPassword } from "@/lib/admin-session";
import { endAdminSession, startAdminSession } from "@/lib/admin-session.server";
import {
  LimitChecks,
  getClientIp,
  getLimitMessage,
  hitAll,
  limiters,
} from "@/lib/rate-limits.server";
import { ActionError, action } from "@/lib/safe-action";
import { z } from "zod";

// a POST with the password, answered by an httpOnly session cookie
export const adminSignIn = action
  .inputSchema(z.object({ password: z.string().max(200) }))
  .action(async ({ parsedInput: { password } }) => {
    // the failures are limited: per address, and for everyone
    const limits: LimitChecks = [
      [limiters.adminFailuresByIp, await getClientIp()],
      [limiters.adminFailures, "all"],
    ];
    const limited = getLimitMessage(limits);
    if (limited) throw new ActionError(limited);

    if (!isAdminPassword(password)) {
      hitAll(limits);
      throw new ActionError("Mot de passe incorrect");
    }

    await startAdminSession();
    return { success: true };
  });

export const adminSignOut = action.action(async () => {
  await endAdminSession();
  return { success: true };
});
