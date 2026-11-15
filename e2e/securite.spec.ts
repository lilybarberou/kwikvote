import { expect, test } from "./support/fixtures";

// The security headers of next.config.js, and the analytics script that must
// not record the query strings (?password= of the admin, ?email= of "Mes
// sondages"). The other journeys prove that these headers break nothing.

const expectSecurityHeaders = (headers: Record<string, string>) => {
  expect(headers["content-security-policy"]).toBe(
    "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
  );
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["permissions-policy"]).toBe(
    "camera=(), microphone=(), geolocation=()",
  );
};

test("security headers on the pages, the service worker and the server actions", async ({
  page,
  request,
}) => {
  const home = await page.goto("/");
  expectSecurityHeaders(home!.headers());

  // a server action (getPollsByEmail) answers with them too
  const actions: Record<string, string>[] = [];
  page.on("response", (response) => {
    if (response.request().headers()["next-action"])
      actions.push(response.headers());
  });
  const myPolls = await page.goto("/mes-sondages?email=personne@example.com");
  expectSecurityHeaders(myPolls!.headers());
  await expect.poll(() => actions.length).toBeGreaterThan(0);
  actions.forEach(expectSecurityHeaders);

  const worker = await request.get("/service.js");
  expect(worker.ok()).toBe(true);
  expectSecurityHeaders(worker.headers());
});

test("the analytics script does not record the query string", async ({
  page,
}) => {
  await page.goto("/admin?password=secret");
  const script = page.locator('script[src*="umami"]');
  await expect(script).toHaveAttribute("data-exclude-search", "true");
});
