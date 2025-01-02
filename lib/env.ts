import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    ADMIN_PASSWORD: z.string(),
    DATABASE_URL: z.string(),
    DOMAIN: z.string(),
    PORT: z.string(),
    VAPID_PRIVATE_KEY: z.string(),
    DISCORD_WEBHOOK_URL: z.string(),
  },

  client: {
    NEXT_PUBLIC_VAPID_EMAIL: z.string(),
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string(),
  },
  experimental__runtimeEnv: {
    ...process.env,
    NEXT_PUBLIC_VAPID_EMAIL: process.env.NEXT_PUBLIC_VAPID_EMAIL,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  },
});

export type Env = typeof env;
