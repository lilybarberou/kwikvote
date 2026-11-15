import { z } from "zod";

// shared with the vote form (components/poll/DialogVote.tsx)
export const VOTE_NAME_MAX_LENGTH = 100;

export const createVoteSchema = z.object({
  id: z.string(),
  name: z.string().max(VOTE_NAME_MAX_LENGTH),
  pollId: z.string(),
  choices: z.array(
    z.object({
      id: z.string(),
      slotId: z.string(),
      choice: z.number(),
      // registration polls only, missing: the stored priority is kept
      priority: z.boolean().optional(),
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
});
export type DeleteVoteSchema = z.infer<typeof deleteVoteSchema>;

export const updateVoteNameSchema = z.object({
  voteId: z.string(),
  name: z.string().max(VOTE_NAME_MAX_LENGTH),
  subscription: z
    .object({
      endpoint: z.string(),
      auth: z.string(),
      p256dh: z.string(),
    })
    .optional(),
});
export type UpdateVoteNameSchema = z.infer<typeof updateVoteNameSchema>;
