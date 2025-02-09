import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    ADMIN_PASSWORD: z.string().min(1),
    DATABASE_URL: z.string().min(1),
    DOMAIN: z.string().url(),
    VAPID_PRIVATE_KEY: z.string().min(1),
    DISCORD_WEBHOOK_URL: z.string().min(1),
    UMAMI_WEBSITE_ID: z.string().min(1),
  },

  client: {
    NEXT_PUBLIC_VAPID_EMAIL: z.string().min(1),
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1),
  },
  experimental__runtimeEnv: {
    ...process.env,
    NEXT_PUBLIC_VAPID_EMAIL: process.env.NEXT_PUBLIC_VAPID_EMAIL,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  },
});

export type Env = typeof env;
