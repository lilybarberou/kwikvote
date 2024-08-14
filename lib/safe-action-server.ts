import { z } from "zod";

import { isPollPasswordValid } from "./api/poll/query";
import { action } from "./safe-action";

export const pwAction = action
  .schema(z.object({ pollId: z.string(), password: z.string() }))
  .use(async ({ next, clientInput }) => {
    const parsedData = z
      .object({
        pollId: z.string(),
        password: z.string(),
      })
      .parse(clientInput);

    const data = await isPollPasswordValid(parsedData);
    const isValid = data?.data;

    if (!isValid) throw new Error("Invalid password");

    return next({ ctx: "" });
  });
