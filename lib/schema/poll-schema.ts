import { z } from "zod";

import { lengthCheckedArray } from "./array";

// shared with the creation form (components/poll/PollForm.tsx) and the votes
// (one choice per slot, lib/schema/vote-schema.ts); 7 at most in production
export const POLL_SLOTS_MAX_COUNT = 50;
export const POLL_SLOTS_MAX_COUNT_MESSAGE = `Un sondage peut avoir ${POLL_SLOTS_MAX_COUNT} créneaux au maximum`;

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
  slots: lengthCheckedArray(
    z.array(
      z.object({
        startDate: z.date(),
        startTime: z.string(),
        endDate: z.date(),
        endTime: z.string(),
        maxParticipants: z.coerce.number().positive(),
      }),
    ),
    POLL_SLOTS_MAX_COUNT,
    POLL_SLOTS_MAX_COUNT_MESSAGE,
  ),
});
export type PollFormSchema = z.infer<typeof pollFormSchema>;

// a date or its serialization: invalid dates are refused instead of failing in
// the database (a bare z.coerce.date() would turn null or a number into a date)
const slotDateSchema = z.union([z.string(), z.date()]).pipe(z.coerce.date());

export const createSlotSchema = z.object({
  startDate: slotDateSchema,
  endDate: slotDateSchema,
  maxParticipants: z.number().int().positive(),
});
export type CreateSlotSchema = z.infer<typeof createSlotSchema>;

// same rules as the creation form (pollFormSchema)
export const createPollSchema = z.object({
  type: z.number().int().positive().min(1).max(2),
  title: z.string().min(1),
  description: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  password: z.string().optional(),
  timeBeforeAllowedType: z.number().int().min(1).max(2),
  // stored in an Int column
  msBeforeAllowed: z.number().int().nonnegative().max(2147483647),
  slots: lengthCheckedArray(
    z.array(createSlotSchema).min(1),
    POLL_SLOTS_MAX_COUNT,
    POLL_SLOTS_MAX_COUNT_MESSAGE,
  ),
});
export type CreatePollSchema = z.infer<typeof createPollSchema>;

export const pollSettingsSchema = pollFormSchema.pick({
  title: true,
  description: true,
});
export type PollSettingsSchema = z.infer<typeof pollSettingsSchema>;

export const updatePollSchema = pollFormSchema
  .pick({ title: true, description: true })
  .extend({ password: z.string() });
export type UpdatePollSchema = z.infer<typeof updatePollSchema>;
