import { z } from "zod";

export const createCommentSchema = z.object({
  comment: z.object({
    author: z.string(),
    text: z.string(),
    pollId: z.string(),
  }),
  exceptEndpoint: z.string().optional(),
});

export type CreateCommentSchema = z.infer<typeof createCommentSchema>;
