import AxeBuilder from "@axe-core/playwright";

import { checkA11y } from "./support/a11y";
import { nextWeekday } from "./support/dates";
import { expect, test } from "./support/fixtures";
import { createPoll, uniqueName } from "./support/poll";

// The pages around the polls: home, FAQ, history of the consulted polls,
// "Mes sondages" without result, the 404 page and the dark theme.

test("history of the consulted polls, FAQ, empty search and unknown page", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Sondages consultés" })
    .first()
    .click();
  await expect(
    page.getByText("Aucun sondage consulté pour le moment."),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  const title = uniqueName("Historique");
  const pollId = await createPoll(page, {
    type: "free",
    title,
    slots: [{ day: nextWeekday(3, 2), start: "12:00", end: "13:00" }],
  });

  await page.getByRole("link", { name: "FAQ" }).first().click();
  await expect(
    page.getByRole("heading", { level: 1, name: "FAQ" }),
  ).toBeVisible();
  await checkA11y(page, "faq");

  // the poll is in the history, which leads back to it
  await page
    .getByRole("button", { name: "Sondages consultés" })
    .first()
    .click();
  await page.getByRole("link", { name: title }).click();
  await expect(page).toHaveURL(new RegExp(`/poll/${pollId}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);

  await page.goto("/mes-sondages?email=personne-e2e@example.com");
  await expect(
    page.getByRole("heading", { name: "C'est vide !" }),
  ).toBeVisible();

  const response = await page.goto("/cette-page-n-existe-pas");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Vous êtes perdu." }),
  ).toBeVisible();
  await checkA11y(page, "404");
});

test("the dark theme on the journeys pages", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Changer le thème" }).click();
  await page.getByRole("menuitem", { name: "Sombre" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await checkA11y(page, "home (dark)");

  await createPoll(page, {
    type: "registration",
    slots: [{ day: nextWeekday(3, 2), start: "12:00", end: "13:00" }],
  });
  await expect(page.locator("html")).toHaveClass(/dark/);
  await checkA11y(page, "registration poll (dark)");
  await page.goto("/poll/creer");
  await checkA11y(page, "creation form (dark)");
  await page.getByRole("button", { name: "Créer" }).hover();
  await checkA11y(page, "hovered button (dark)", { keepMouse: true });
});

test("the theme menu: keyboard, click outside, and the page stays readable", async ({
  page,
}) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Changer le thème" });
  const menu = page.getByRole("menu");
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(menu.getByRole("menuitem", { name: "Clair" })).toBeFocused();

  // the rest of the page is not hidden from assistive technologies: axe
  // finds nothing, strictly here (the open menu was the last violation)
  await expect(page.locator("main")).not.toHaveAttribute("aria-hidden");
  await page
    .waitForFunction(() =>
      document.getAnimations().every((a) => a.playState !== "running"),
    )
    .catch(() => {});
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(violations.map(({ id, nodes }) => `${id} (${nodes.length})`)).toEqual(
    [],
  );

  // the keyboard: arrows move, Tab stays in the menu, Escape closes it
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitem", { name: "Sombre" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(menu.getByRole("menuitem", { name: "Sombre" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
  // each key waits for the focus to move: the menu opens asynchronously
  await page.keyboard.press("Enter");
  await expect(menu.getByRole("menuitem", { name: "Clair" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitem", { name: "Sombre" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();

  // a click outside closes the menu, and reaches what it was on
  await trigger.click();
  await expect(menu).toBeVisible();
  await page.getByRole("link", { name: "FAQ" }).first().click();
  await expect(menu).toBeHidden();
  await expect(page).toHaveURL(/\/faq$/);
});

test("the hovered buttons keep their contrast", async ({ page }) => {
  await page.goto("/poll/creer");
  await page.getByRole("button", { name: "Créer" }).hover();
  await checkA11y(page, "hovered button", { keepMouse: true });
});
