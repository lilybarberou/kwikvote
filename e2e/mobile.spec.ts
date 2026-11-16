import { devices } from "@playwright/test";

import { checkA11y } from "./support/a11y";
import { addDays, nextWeekday } from "./support/dates";
import { expect, test } from "./support/fixtures";
import {
  createPoll,
  expectRegistrations,
  fillVoteDialog,
  openRegistration,
  submitVoteDialog,
  vote,
} from "./support/poll";

// The same journeys on a phone: touch screen, narrow layout, menu button.
const { defaultBrowserType: _, ...pixel } = devices["Pixel 7"];
test.use(pixel);

test("on a phone: menu, creation, registration and priority", async ({
  page,
  participant,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  const menu = page.getByRole("navigation", { name: "Menu" });
  await menu.getByRole("link", { name: "FAQ" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "FAQ" }),
  ).toBeVisible();
  await expect(menu).toBeHidden();
  await checkA11y(page, "faq (mobile)");

  const friday = nextWeekday(5, 3);
  const slots = [
    { day: friday, start: "18:00", end: "20:00", maxParticipants: 1 },
    {
      day: addDays(friday, 1),
      start: "18:00",
      end: "20:00",
      maxParticipants: 1,
    },
  ];
  await createPoll(page, { type: "registration", slots });
  await checkA11y(page, "registration poll (mobile)");

  const alice = await participant();
  await alice.page.goto(page.url());
  await vote(alice.page, slots, { name: "Alice", choices: ["Oui", "Oui"] });

  // a tap outside the vote dialog doesn't close it on a phone
  await page.reload();
  await openRegistration(page, "Alice");
  await page.mouse.click(5, 5);
  await expect(
    page.getByRole("dialog", { name: "Modifier une inscription" }),
  ).toBeVisible();
  await fillVoteDialog(page, slots, { priorities: [1] });
  await checkA11y(page, "vote dialog (mobile)");
  await submitVoteDialog(page);
  await expectRegistrations(page, [
    { registered: [], reregistered: ["Alice"] },
    { registered: ["Alice (créneau prioritaire)"] },
  ]);
});

test("on a phone: the menu with the keyboard", async ({ page }) => {
  await page.goto("/");
  const openButton = page.getByRole("button", { name: "Ouvrir le menu" });
  const menu = page.getByRole("navigation", { name: "Menu" });
  await expect(openButton).toHaveAttribute("aria-expanded", "false");
  await expect(openButton).toHaveAttribute("aria-controls", "menu-mobile");

  await openButton.focus();
  await page.keyboard.press("Enter");
  const closeButton = page.getByRole("button", { name: "Fermer le menu" });
  await expect(closeButton).toHaveAttribute("aria-expanded", "true");
  await expect(menu).toHaveAttribute("id", "menu-mobile");
  // the focus enters the menu...
  await expect(menu.getByRole("link", { name: "Accueil" })).toBeFocused();

  // ...and stays in it, or on the button that closes it, both ways
  const focusInMenu = () =>
    page.evaluate(() => {
      const focused = document.activeElement;
      return (
        !!document.getElementById("menu-mobile")?.contains(focused) ||
        focused?.getAttribute("aria-controls") === "menu-mobile"
      );
    });
  for (const key of ["Tab", "Shift+Tab"])
    for (let i = 0; i < 7; i++) {
      await page.keyboard.press(key);
      expect(await focusInMenu(), `${key} x${i + 1}`).toBe(true);
    }
  // the order: the button, then the links
  await menu.getByRole("link", { name: "Roadmap" }).focus();
  await page.keyboard.press("Tab");
  await expect(closeButton).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(menu.getByRole("link", { name: "Accueil" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(closeButton).toBeFocused();
  await checkA11y(page, "menu (mobile)");

  // Escape closes it and gives the focus back to its button
  await menu.getByRole("link", { name: "FAQ" }).focus();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(openButton).toBeFocused();
  await expect(openButton).toHaveAttribute("aria-expanded", "false");

  // its button closes it too, and its links lead to their page
  await page.keyboard.press("Enter");
  await expect(menu).toBeVisible();
  await page.keyboard.press("Shift+Tab");
  await expect(closeButton).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(menu).toBeHidden();
  await openButton.click();
  await page.keyboard.press("Tab");
  await expect(menu.getByRole("link", { name: "Mes sondages" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/mes-sondages$/);
  await expect(menu).toBeHidden();
});
