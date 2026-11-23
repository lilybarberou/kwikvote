import { describe, expect, test } from "vitest";
import { z } from "zod";

import { isEmail } from "./email";

const samples = [
  "demo@example.com",
  "first.last+tag@sub.example.org",
  "o'neil@example.org",
  "a_b-c@ex-ample.example",
  "",
  " demo@example.com",
  "demo@example.com ",
  "demo@example",
  "demo@@example.com",
  ".demo@example.com",
  "demo.@example.com",
  "de..mo@example.com",
  "demo@-example.com",
  "demo@example.c",
  "démo@example.com",
  "demo@exämple.com",
  "@example.com",
  "demo",
];

describe("isEmail", () => {
  test.each(samples)("agrees with z.string().email() on %j", (sample) => {
    expect(isEmail(sample)).toBe(z.string().email().safeParse(sample).success);
  });
});
