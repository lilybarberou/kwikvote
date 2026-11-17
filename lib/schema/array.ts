import { z } from "zod";

/**
 * An array schema whose length is checked BEFORE its elements.
 *
 * zod 3 validates every element before `.max()`, and keeps one issue per
 * invalid element: a 1 MB request body of `[1,1,1,…]` (half a million
 * elements) costs about 200 MB of memory per request, `.max()` or not.
 * Here a too long array is refused with a single issue, without reading its
 * elements. Anything else (an array short enough, or not an array at all) is
 * validated by `array` as before, so the inferred input and output types are
 * the ones of `array`.
 */
export const lengthCheckedArray = <Schema extends z.ZodArray<z.ZodTypeAny>>(
  array: Schema,
  maxLength: number,
  message: string,
) =>
  z
    .custom<z.input<Schema>>(
      (value) => !Array.isArray(value) || value.length <= maxLength,
      { message, fatal: true },
    )
    .pipe(array);
