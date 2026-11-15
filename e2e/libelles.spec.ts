import { Locator, devices } from "@playwright/test";

import { checkA11y } from "./support/a11y";
import { nextWeekday } from "./support/dates";
import { ADMIN_PASSWORD } from "./support/env";
import { expect, test } from "./support/fixtures";
import { createPoll } from "./support/poll";

// The text fields outside the forms of the polls are named by a label that
// everyone sees, not only by a placeholder that disappears while typing.

const expectVisibleLabel = async (field: Locator, text: string) => {
  await expect(field).toBeVisible();
  const label = await field.evaluate((element) => {
    const label = (element as HTMLInputElement).labels?.[0];
    if (!label) return null;
    const box = label.getBoundingClientRect();
    return {
      text: label.textContent,
      // a visually hidden label (sr-only) is 1px wide
      visible: box.width > 1 && box.height > 1,
      ariaLabel: element.getAttribute("aria-label"),
    };
  });
  expect(label).toEqual({ text, visible: true, ariaLabel: null });
};

const slots = [{ day: nextWeekday(4, 2), start: "19:00", end: "21:00" }];

test("the home, comments and admin fields have a visible label", async ({
  page,
}) => {
  await page.goto("/");
  await expectVisibleLabel(page.getByLabel("Votre email"), "Votre email");

  await createPoll(page, { type: "free", slots });
  await page.getByRole("tab", { name: "Commentaires (0)" }).click();
  const comments = page.getByRole("tabpanel", { name: /^Commentaires/ });
  await expectVisibleLabel(comments.getByLabel("Auteur"), "Auteur");
  await expectVisibleLabel(comments.getByLabel("Message"), "Message");
  await checkA11y(page, "comments (labels)");

  await page.goto("/admin");
  await page.getByLabel("Mot de passe administrateur").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expectVisibleLabel(
    page.getByRole("searchbox", { name: "Rechercher un sondage" }),
    "Rechercher un sondage",
  );
  await checkA11y(page, "admin (labels)");
});

test.describe("on a phone", () => {
  const { defaultBrowserType: _, ...pixel } = devices["Pixel 7"];
  test.use(pixel);

  test("the home email field and its button stay on one line", async ({
    page,
  }) => {
    await page.goto("/");
    const field = page.getByLabel("Votre email");
    await expectVisibleLabel(field, "Votre email");
    const button = page.getByRole("button", { name: "Rechercher" });
    const [fieldBox, buttonBox] = await Promise.all([
      field.boundingBox(),
      button.boundingBox(),
    ]);
    // side by side, bottoms aligned, inside the screen
    expect(buttonBox!.x).toBeGreaterThan(fieldBox!.x + fieldBox!.width);
    expect(
      Math.abs(
        buttonBox!.y + buttonBox!.height - (fieldBox!.y + fieldBox!.height),
      ),
    ).toBeLessThan(2);
    expect(buttonBox!.x + buttonBox!.width).toBeLessThanOrEqual(
      page.viewportSize()!.width,
    );
    await checkA11y(page, "home (labels, mobile)");
  });
});
