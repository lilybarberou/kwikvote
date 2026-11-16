import { z } from "zod";

// limits shared with the comment form (components/poll/PollComments.tsx)
export const COMMENT_AUTHOR_MAX_LENGTH = 100;
export const COMMENT_TEXT_MAX_LENGTH = 5000;

export const createCommentSchema = z.object({
  comment: z.object({
    author: z.string().max(COMMENT_AUTHOR_MAX_LENGTH),
    text: z.string().max(COMMENT_TEXT_MAX_LENGTH),
    pollId: z.string(),
  }),
  exceptEndpoint: z.string().optional(),
});

export type CreateCommentSchema = z.infer<typeof createCommentSchema>;
