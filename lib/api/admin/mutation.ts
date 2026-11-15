"use server";

import { isAdminPassword } from "@/lib/admin-session";
import { endAdminSession, startAdminSession } from "@/lib/admin-session.server";
import { ActionError, action } from "@/lib/safe-action";
import { z } from "zod";

// a POST with the password, answered by an httpOnly session cookie
export const adminSignIn = action
  .schema(z.object({ password: z.string().max(200) }))
  .action(async ({ parsedInput: { password } }) => {
    if (!isAdminPassword(password))
      throw new ActionError("Mot de passe incorrect");

    await startAdminSession();
    return { success: true };
  });

export const adminSignOut = action.action(async () => {
  await endAdminSession();
  return { success: true };
});
