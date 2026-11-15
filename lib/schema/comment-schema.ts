import { z } from "zod";

import { COMMENT_AUTHOR_MAX_LENGTH, COMMENT_TEXT_MAX_LENGTH } from "./limits";

export { COMMENT_AUTHOR_MAX_LENGTH, COMMENT_TEXT_MAX_LENGTH };

export const createCommentSchema = z.object({
  comment: z.object({
    author: z.string().max(COMMENT_AUTHOR_MAX_LENGTH),
    text: z.string().max(COMMENT_TEXT_MAX_LENGTH),
    pollId: z.string(),
  }),
  exceptEndpoint: z.string().optional(),
});

export type CreateCommentSchema = z.infer<typeof createCommentSchema>;
