// The default regex of z.email() (zod/v4/core/regexes.ts, `email`), for the
// client forms that only check an email: zod itself weighs ~35 kB gzipped on
// the page. lib/email.test.ts checks that both agree.
export const EMAIL_PATTERN =
  /^(?:[A-Za-z0-9_'+\-]+\.)*[A-Za-z0-9_'+\-]*[A-Za-z0-9_+-]@(?:[A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;

export const isEmail = (value: string) => EMAIL_PATTERN.test(value);
