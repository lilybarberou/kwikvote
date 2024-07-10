import { z } from "zod";

export const createVoteSchema = z.object({
  id: z.string(),
  name: z.string(),
  pollId: z.string(),
  pollType: z.number(),
  choices: z.array(
    z.object({
      id: z.string(),
      slotId: z.string(),
      choice: z.number(),
    }),
  ),
  subscription: z
    .object({
      endpoint: z.string(),
      auth: z.string(),
      p256dh: z.string(),
    })
    .optional(),
});
export type CreateVoteSchema = z.infer<typeof createVoteSchema>;

export const deleteVoteSchema = z.object({
  voteId: z.string(),
  pollId: z.string(),
  pollType: z.number(),
});
export type DeleteVoteSchema = z.infer<typeof deleteVoteSchema>;

export const updateVoteNameSchema = z.object({
  voteId: z.string(),
  name: z.string(),
});
export type UpdateVoteNameSchema = z.infer<typeof updateVoteNameSchema>;
