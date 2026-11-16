import { describe, expect, test } from "vitest";

import {
  COMMENT_AUTHOR_MAX_LENGTH,
  COMMENT_TEXT_MAX_LENGTH,
  createCommentSchema,
} from "./comment-schema";

const parse = (author: string, text: string) =>
  createCommentSchema.safeParse({ comment: { author, text, pollId: "poll" } })
    .success;

describe("createCommentSchema", () => {
  test("author and text are limited", () => {
    expect(parse("A", "Hello")).toBe(true);
    expect(
      parse(
        "a".repeat(COMMENT_AUTHOR_MAX_LENGTH),
        "t".repeat(COMMENT_TEXT_MAX_LENGTH),
      ),
    ).toBe(true);
    expect(parse("a".repeat(COMMENT_AUTHOR_MAX_LENGTH + 1), "Hello")).toBe(
      false,
    );
    expect(parse("A", "t".repeat(COMMENT_TEXT_MAX_LENGTH + 1))).toBe(false);
  });
});
