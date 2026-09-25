import { parisDateTimeToUtc } from "@/lib/utils";
import { z } from "zod";

const timeRegex = /^\d{2}:\d{2}$/;

export const slotFormSchema = z
  .object({
    startDate: z.date(),
    startTime: z.string().regex(timeRegex),
    endDate: z.date(),
    endTime: z.string().regex(timeRegex),
  })
  .refine(
    (slot) =>
      // invalid times are already reported by their own field
      !timeRegex.test(slot.startTime) ||
      !timeRegex.test(slot.endTime) ||
      parisDateTimeToUtc(slot.endDate, slot.endTime) >
        parisDateTimeToUtc(slot.startDate, slot.startTime),
    {
      message: "La fin du créneau doit être après son début",
      path: ["endTime"],
    },
  );
export type SlotFormSchema = z.infer<typeof slotFormSchema>;

export const updateSlotSchema = z.object({
  slotId: z.string(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  exceptEndpoint: z.string().optional(),
});
export type UpdateSlotSchema = z.infer<typeof updateSlotSchema>;
