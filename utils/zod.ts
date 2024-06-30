import { z } from "zod";

export const PollSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
});

export const CommentSchema = z.object({
  id: z.string().uuid(),
  content: z.string(),
  pollId: z.string().uuid(),
  poll: PollSchema,
});
