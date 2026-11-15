import { z } from "zod";

import { slotFormSchema } from "./slot-schema";

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
    // same rules as the slot edition form: the end must be after the start
    slotFormSchema.and(
      z.object({
        // a number input: its value is a string once edited
        maxParticipants: z.coerce.number().positive(),
      }),
    ),
  ),
});
export type PollFormSchema = z.infer<typeof pollFormSchema>;

// a date or its serialization: invalid dates are refused instead of failing in
// the database (a bare z.coerce.date() would turn null or a number into a date)
const slotDateSchema = z.union([z.string(), z.date()]).pipe(z.coerce.date());

export const createSlotSchema = z
  .object({
    startDate: slotDateSchema,
    endDate: slotDateSchema,
    maxParticipants: z.number().int().positive(),
  })
  // like updateSlotById
  .refine((slot) => slot.endDate > slot.startDate, {
    message: "End date must be after start date",
    path: ["endDate"],
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
  slots: z.array(createSlotSchema).min(1),
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
