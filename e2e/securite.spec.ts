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
  // poweredByHeader: false in next.config.js
  expect(headers["x-powered-by"]).toBeUndefined();
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

// The arrays sent to the server actions are limited, and their length is
// checked before their elements (lib/schema/array.ts).
const SLOTS_MAX_COUNT_MESSAGE = "Un sondage peut avoir 50 créneaux au maximum";

test("the creation form allows 50 slots at most", async ({ page }) => {
  await page.goto("/poll/creer");
  const addSlot = page.getByRole("button", { name: "Ajouter un créneau" });
  await expect(page.getByText("Date de début")).toHaveCount(1);
  await expect(page.getByText(SLOTS_MAX_COUNT_MESSAGE)).toBeHidden();

  for (let count = 1; count < 50; count++) await addSlot.click();

  await expect(page.getByText("Date de début")).toHaveCount(50);
  await expect(addSlot).toBeDisabled();
  await expect(page.getByText(SLOTS_MAX_COUNT_MESSAGE)).toBeVisible();
});

test("a server action with a huge array is refused at once", async ({
  page,
}) => {
  await page.goto("/poll/creer");
  await page.getByLabel("Titre du sondage").fill(`Tableau ${Date.now()}`);

  // the slots of the creation become [1,1,1,…]: about 800 KB, under the 1 MB
  // body limit of the server actions
  const answers: { status: number; body: string }[] = [];
  await page.route("**/poll/creer", async (route) => {
    const request = route.request();
    if (request.method() !== "POST" || !request.headers()["next-action"])
      return route.fallback();
    const args = JSON.parse(request.postData()!);
    args[0].slots = new Array(400_000).fill(1);
    const response = await route.fetch({ postData: JSON.stringify(args) });
    const body = await response.text();
    answers.push({ status: response.status(), body });
    await route.fulfill({ response, body });
  });
  await page.getByRole("button", { name: "Créer" }).click();

  // a single validation error, not one per element
  await expect.poll(() => answers.length).toBe(1);
  expect(answers[0].status).toBe(200);
  expect(answers[0].body).toContain(SLOTS_MAX_COUNT_MESSAGE);
  expect(answers[0].body.length).toBeLessThan(10_000);
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Erreur lors de la création du sondage" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/poll\/creer$/);
});
