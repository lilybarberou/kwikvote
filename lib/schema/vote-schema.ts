import { z } from "zod";

import { lengthCheckedArray } from "./array";
import { POLL_SLOTS_MAX_COUNT } from "./poll-schema";

// shared with the vote form (components/poll/DialogVote.tsx)
export const VOTE_NAME_MAX_LENGTH = 100;

export const createVoteSchema = z.object({
  id: z.string(),
  name: z.string().max(VOTE_NAME_MAX_LENGTH),
  pollId: z.string(),
  // one choice per slot of the poll
  choices: lengthCheckedArray(
    z.array(
      z.object({
        id: z.string(),
        slotId: z.string(),
        choice: z.number(),
      }),
    ),
    POLL_SLOTS_MAX_COUNT,
    `Un vote peut avoir ${POLL_SLOTS_MAX_COUNT} choix au maximum`,
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
