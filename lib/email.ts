// The regex of z.string().email() (zod 3, emailRegex of v3/types.ts), for the
// client forms that only check an email: zod itself weighs ~35 kB gzipped on
// the page. lib/email.test.ts checks that both agree.
export const EMAIL_PATTERN =
  /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;

export const isEmail = (value: string) => EMAIL_PATTERN.test(value);
