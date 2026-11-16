import { Page } from "@playwright/test";

import { checkA11y } from "./support/a11y";
import { nextWeekday } from "./support/dates";
import { db } from "./support/db";
import { expect, test } from "./support/fixtures";
import { createPoll, uniqueName } from "./support/poll";

// Loading a poll: only a poll that doesn't exist leaves the history of the
// consulted polls; a failure (server, network) can be retried.

const slots = [{ day: nextWeekday(3, 2), start: "12:00", end: "13:00" }];

const openHistory = async (page: Page) => {
  await page
    .getByRole("button", { name: "Sondages consultés" })
    .first()
    .click();
};

test("a deleted poll says it doesn't exist and leaves the history", async ({
  page,
}) => {
  const title = uniqueName("Supprimé");
  const pollId = await createPoll(page, { type: "free", title, slots });
  await openHistory(page);
  await expect(page.getByRole("link", { name: title })).toBeVisible();
  await page.keyboard.press("Escape");

  await db.poll.delete({ where: { id: pollId } });
  await page.goto(`/poll/${pollId}`);
  await expect(
    page.getByRole("heading", { name: "Ce sondage n'existe pas" }),
  ).toBeVisible();
  await expect(page).toHaveTitle(/Ce sondage n'existe pas/);
  await openHistory(page);
  await expect(
    page.getByText("Aucun sondage consulté pour le moment."),
  ).toBeVisible();
});

test("a poll that fails to load stays in the history and can be retried", async ({
  page,
}) => {
  // several loads, each retried by react-query
  test.slow();
  const title = uniqueName("Coupure");
  const pollId = await createPoll(page, { type: "free", title, slots });

  // the server actions of the poll page, until told otherwise:
  // - "server": the database is down, the action answers its server error
  // - "network": no answer at all
  let failure: "server" | "network" | null = "server";
  let failures = 0;
  await page.route(
    (url) => url.pathname === `/poll/${pollId}`,
    async (route) => {
      const request = route.request();
      if (!failure || !request.headers()["next-action"])
        return route.continue();
      failures++;
      if (failure === "network") return route.abort("internetdisconnected");
      // the real answer, its data replaced by the error of a failed query
      const response = await route.fetch();
      const body = (await response.text()).replace(
        /^1:.*$/m,
        '1:{"serverError":"Une erreur est survenue, veuillez réessayer plus tard"}',
      );
      return route.fulfill({ response, body });
    },
  );

  const error = page.getByRole("heading", {
    name: "Impossible de charger ce sondage",
  });
  const retry = page.getByRole("button", { name: "Réessayer" });

  await page.goto(`/poll/${pollId}`);
  // after the automatic retries of react-query
  await expect(error).toBeVisible({ timeout: 30_000 });
  expect(failures).toBeGreaterThan(1);
  await expect(
    page.getByRole("heading", { name: "Ce sondage n'existe pas" }),
  ).toBeHidden();
  await checkA11y(page, "poll load error");

  // still in the history
  await openHistory(page);
  await expect(page.getByRole("link", { name: title })).toBeVisible();
  await page.keyboard.press("Escape");

  // no network: still an error, still in the history
  failure = "network";
  failures = 0;
  await retry.click();
  await expect.poll(() => failures, { timeout: 30_000 }).toBeGreaterThan(1);
  await expect(retry).toBeEnabled({ timeout: 30_000 });
  await expect(error).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("pollHistory")),
  ).toContain(pollId);

  // the server is back
  failure = null;
  await retry.click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(error).toBeHidden();
});
