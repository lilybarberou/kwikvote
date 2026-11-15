import { Locator } from "@playwright/test";

import { nextWeekday, slotDayLabel } from "./support/dates";
import { expect, test } from "./support/fixtures";
import { createPoll, openRegistration, vote, voteDialog } from "./support/poll";

// Every dialog is named by a real title: a heading of the dialog that its
// aria-labelledby points to, not an aria-label. Its aria-describedby, if any,
// points to elements of the page.
const expectTitled = async (
  dialog: Locator,
  name: string,
  description?: RegExp,
) => {
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAccessibleName(name);
  await expect(dialog).not.toHaveAttribute("aria-label");
  const title = dialog.getByRole("heading", { name, exact: true });
  await expect(title).toHaveCount(1);
  await expect(dialog).toHaveAttribute(
    "aria-labelledby",
    (await title.getAttribute("id"))!,
  );
  if (description)
    await expect(dialog).toHaveAccessibleDescription(description);
  const describedBy = await dialog.getAttribute("aria-describedby");
  for (const id of describedBy?.split(/\s+/) ?? [])
    await expect(dialog.page().locator(`[id="${id}"]`)).toHaveCount(1);
};

test("every dialog is named by its title", async ({ page, participant }) => {
  // several participants, each in a browser of their own
  test.slow();
  const day = nextWeekday(4, 3);
  const slots = [{ day, start: "18:00", end: "20:00", maxParticipants: 2 }];
  await createPoll(page, { type: "registration", password: "secret", slots });
  const pollUrl = page.url().split("?")[0];

  // the "poll created" dialog, shown again
  await page.goto(`${pollUrl}?created=true`);
  const created = page.getByRole("alertdialog", { name: "Sondage créé !" });
  await expectTitled(created, "Sondage créé !", /^Conservez bien votre lien :/);
  await created.getByRole("button", { name: "Fermer" }).click();
  await expect(created).toBeHidden();

  // the help of the lists: a title for screen readers only
  await page.getByRole("button", { name: "Aide" }).click();
  const help = page.getByRole("dialog", { name: "Aide" });
  await expectTitled(help, "Aide");
  await help.getByRole("button", { name: "Fermer" }).click();
  await expect(help).toBeHidden();

  // the vote dialog, new and opened
  await page.getByRole("button", { name: "Nouvelle inscription" }).click();
  await expectTitled(voteDialog(page), "Ajouter une inscription");
  await voteDialog(page).getByRole("button", { name: "Annuler" }).click();
  await expect(voteDialog(page)).toBeHidden();
  await vote(page, slots, { name: "Alice", choices: ["Oui"] });
  await openRegistration(page, "Alice");
  await expectTitled(voteDialog(page), "Modifier une inscription");
  await voteDialog(page).getByRole("button", { name: "Annuler" }).click();
  await expect(voteDialog(page)).toBeHidden();

  // the notifications, offered to a browser that supports them
  const bob = await participant({ notifications: true });
  await bob.page.goto(pollUrl);
  await bob.page
    .getByRole("button", { name: "Activer les notifications" })
    .click();
  const notifications = bob.page.getByRole("alertdialog", {
    name: "Activer les notifications",
  });
  await expectTitled(
    notifications,
    "Activer les notifications",
    /^Vous recevrez une notification/,
  );
  await notifications.getByRole("button", { name: "Annuler" }).click();
  await expect(notifications).toBeHidden();

  // the settings, at both steps (password, then management)
  await page.getByRole("button", { name: "Paramètres du sondage" }).click();
  const settings = page.getByRole("dialog", { name: "Paramètres du sondage" });
  await expectTitled(settings, "Paramètres du sondage");
  await settings.getByLabel("Mot de passe").fill("secret");
  await settings.getByRole("button", { name: "Valider" }).click();
  await settings.getByRole("button", { name: "Gérer les créneaux" }).click();
  await expectTitled(settings, "Paramètres du sondage");

  // the slot edition, described by what saving does
  await settings
    .getByRole("button", {
      name: `Modifier le créneau du ${slotDayLabel(day)} 18:00`,
    })
    .click();
  await expectTitled(
    page.getByRole("dialog", { name: "Modifier le créneau" }),
    "Modifier le créneau",
    /Les participants ayant activé les notifications seront prévenus\.$/,
  );
});
