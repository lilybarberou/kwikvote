import { z } from "zod";

export const pollFormSchema = z.object({
  type: z.enum(["1", "2"]),
  title: z.string().min(1),
  description: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  password: z.string().optional(),
  timeBeforeAllowedType: z.enum(["1", "2"]),
  hoursBeforeAllowed: z
    .number()
    .positive()
    .optional()
    .or(z.string().regex(/^\d+$/)),
  slots: z.array(
    z.object({
      startDate: z.date(),
      startTime: z.string(),
      endDate: z.date(),
      endTime: z.string(),
      maxParticipants: z.coerce.number().positive(),
    }),
  ),
});
export type PollFormSchema = z.infer<typeof pollFormSchema>;

export const createSlotSchema = z.object({
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()),
  maxParticipants: z.number().int().positive(),
});
export type CreateSlotSchema = z.infer<typeof createSlotSchema>;

export const createPollSchema = z.object({
  type: z.number().int().positive().min(1).max(2),
  title: z.string(),
  description: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  password: z.string().optional(),
  timeBeforeAllowedType: z.number(),
  msBeforeAllowed: z.number(),
  slots: z.array(createSlotSchema),
});
export type CreatePollSchema = z.infer<typeof createPollSchema>;

export const pollSettingsSchema = pollFormSchema.pick({
  title: true,
  description: true,
});
export type PollSettingsSchema = z.infer<typeof pollSettingsSchema>;

export const updatePollSchema = pollFormSchema
  .pick({ title: true, description: true })
  .extend({ pollId: z.string() });
