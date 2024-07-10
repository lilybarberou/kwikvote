import { z } from "zod";

export const createSubscriptionSchema = z.object({
  endpoint: z.string(),
  keys: z.object({
    auth: z.string(),
    p256dh: z.string(),
  }),
});
export type CreateSubscriptionSchema = z.infer<typeof createSubscriptionSchema>;
