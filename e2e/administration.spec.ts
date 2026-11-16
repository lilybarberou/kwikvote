import { Page } from "@playwright/test";

import { checkA11y } from "./support/a11y";
import { addDays, nextWeekday, slotDayLabel } from "./support/dates";
import { ADMIN_PASSWORD } from "./support/env";
import { expect, test } from "./support/fixtures";
import {
  createPoll,
  expectRegistrations,
  pickInOpenCalendar,
  uniqueName,
  vote,
} from "./support/poll";

// A poll created with a password can be managed by its author (title,
// description, slots, deletion); the admin page manages every poll.

const friday = nextWeekday(5, 3);
const saturday = addDays(friday, 1);

// the password is asked once: the dialog keeps its step when reopened
const openSettings = async (page: Page, password?: string) => {
  await page.getByRole("button", { name: "Paramètres du sondage" }).click();
  const settings = page.getByRole("dialog", { name: "Paramètres du sondage" });
  if (password) {
    await settings.getByLabel("Mot de passe").fill(password);
    await settings.getByRole("button", { name: "Valider" }).click();
  }
  return settings;
};

test("without a password, a poll can't be managed", async ({ page }) => {
  await createPoll(page, {
    type: "free",
    slots: [{ day: friday, start: "12:00", end: "13:00" }],
  });
  await expect(page.getByRole("tab", { name: "Votes" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Paramètres du sondage" }),
  ).toHaveCount(0);
});

test("the author manages the poll with its password: wrong password, title, slots, deletion", async ({
  page,
  participant,
}) => {
  // several participants, each in a browser of their own
  test.slow();
  const slots = [
    { day: friday, start: "18:00", end: "20:00", maxParticipants: 1 },
    { day: saturday, start: "18:00", end: "20:00", maxParticipants: 1 },
  ];
  await createPoll(page, {
    type: "registration",
    password: "secret-auteur",
    slots,
  });
  const pollUrl = page.url();

  const alice = await participant();
  await alice.page.goto(pollUrl);
  await vote(alice.page, slots, { name: "Alice", choices: ["Oui", "Oui"] });

  // a wrong password is refused, and said so
  const settings = await openSettings(page, "pas-le-bon");
  const password = settings.getByLabel("Mot de passe");
  await expect(password).toHaveAttribute("aria-invalid", "true");
  await expect(password).toHaveAccessibleDescription("Mot de passe incorrect");
  await expect(
    settings.getByRole("button", { name: "Gérer le sondage" }),
  ).toHaveCount(0);
  await checkA11y(page, "poll settings (wrong password)");

  await password.fill("secret-auteur");
  await settings.getByRole("button", { name: "Valider" }).click();

  // title and description
  await settings.getByRole("button", { name: "Gérer le sondage" }).click();
  const newTitle = uniqueName("Tournoi");
  await settings.getByLabel("Titre du sondage").fill(newTitle);
  await settings.getByLabel("Description").fill("Venez à l'heure");
  await settings.getByRole("button", { name: "Enregistrer" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Sondage mis à jour" }),
  ).toBeVisible();
  await checkA11y(page, "poll settings");
  // not Escape: it would close the toast first
  await settings.getByRole("button", { name: "Fermer" }).click();
  await expect(settings).toBeHidden();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(newTitle);
  await expect(page.getByText("Venez à l'heure")).toBeVisible();
  await openSettings(page);

  // moving saturday to thursday: thursday is now the first slot, the lists
  // are computed again (alice is registered on it and reregistered on friday)
  await settings.getByRole("button", { name: "Gérer les créneaux" }).click();
  await settings
    .getByRole("button", {
      name: `Modifier le créneau du ${slotDayLabel(saturday)} 18:00`,
    })
    .click();
  const edit = page.getByRole("dialog", { name: "Modifier le créneau" });
  await edit.getByRole("button", { name: /^Date de début/ }).click();
  const thursday = addDays(friday, -1);
  await pickInOpenCalendar(page, thursday);
  await edit.getByRole("button", { name: /^Date de fin/ }).click();
  await pickInOpenCalendar(page, thursday);
  await edit.getByRole("button", { name: "Enregistrer" }).click();
  await expect(edit).toBeHidden();
  await expect(
    page.getByRole("status").filter({ hasText: "Créneau mis à jour" }),
  ).toBeVisible();
  await settings.getByRole("button", { name: "Fermer" }).click();
  await expect(settings).toBeHidden();
  await expect(page.getByRole("columnheader").nth(1)).toHaveAccessibleName(
    `${slotDayLabel(thursday)} 18:00 - 20:00`,
  );
  await expectRegistrations(page, [
    { registered: ["Alice"], reregistered: [] },
    { registered: [], reregistered: ["Alice"] },
  ]);

  // deleting thursday: alice gets friday back
  const settingsAgain = await openSettings(page);
  await settingsAgain
    .getByRole("button", { name: "Gérer les créneaux" })
    .click();
  await settingsAgain
    .getByRole("button", {
      name: `Supprimer le créneau du ${slotDayLabel(thursday)} 18:00`,
    })
    .click();
  await page
    .getByRole("dialog")
    .filter({ hasText: "Confirmer la suppression du créneau" })
    .getByRole("button", { name: "Supprimer" })
    .click();
  await expect(
    settingsAgain.getByRole("button", { name: /^Supprimer le créneau du/ }),
  ).toHaveCount(1);
  await settingsAgain.getByRole("button", { name: "Fermer" }).click();
  await expect(page.getByRole("columnheader")).toHaveCount(2);
  await expectRegistrations(page, [
    { registered: ["Alice"], reregistered: [] },
  ]);

  // deleting the poll: back home, the link is dead
  const settingsLast = await openSettings(page);
  await settingsLast.getByRole("button", { name: "Gérer le sondage" }).click();
  await settingsLast
    .getByRole("button", { name: "Supprimer le sondage" })
    .click();
  await page
    .getByRole("dialog")
    .filter({ hasText: "Confirmer la suppression du sondage" })
    .getByRole("button", { name: "Supprimer" })
    .click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto(pollUrl);
  await expect(
    page.getByRole("heading", { name: "Ce sondage n'existe pas" }),
  ).toBeVisible();
});

test("the admin page: a sign in form and a session cookie, it finds and deletes any poll", async ({
  page,
}) => {
  const title = uniqueName("Admin");
  await createPoll(page, {
    type: "free",
    title,
    password: "secret-auteur",
    slots: [{ day: friday, start: "12:00", end: "13:00" }],
  });
  const pollUrl = page.url();

  // the admin password also opens the settings of any poll
  const settings = await openSettings(page, ADMIN_PASSWORD);
  await expect(
    settings.getByRole("button", { name: "Gérer le sondage" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  // the password is never read from the URL any more (old bookmarks)
  await page.goto(`/admin?password=${ADMIN_PASSWORD}`);
  await expect(page.getByText(/ne se met plus dans l'adresse/)).toBeVisible();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("searchbox")).toHaveCount(0);

  // a wrong password is refused, and said so
  const password = page.getByLabel("Mot de passe administrateur");
  await password.fill("pas-le-bon");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(password).toHaveAttribute("aria-invalid", "true");
  await expect(password).toHaveAccessibleDescription("Mot de passe incorrect");
  await checkA11y(page, "admin sign in (wrong password)");

  // signed in: an httpOnly session cookie, without the password
  await password.fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(
    page.getByRole("searchbox", { name: "Rechercher un sondage" }),
  ).toBeVisible();
  const [cookie] = (await page.context().cookies()).filter(
    (c) => c.name === "kwikvote_admin",
  );
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax" });
  expect(cookie.value).not.toContain(ADMIN_PASSWORD);
  await page
    .getByRole("searchbox", { name: "Rechercher un sondage" })
    .fill(title);
  await expect(page).toHaveURL(/[?&]q=/);
  await expect(page.getByRole("link")).toContainText([title]);
  const link = page.getByRole("link", { name: title });
  await expect(link).toHaveAttribute("href", new URL(pollUrl).pathname);
  await checkA11y(page, "admin");

  await page
    .getByRole("button", { name: `Supprimer le sondage ${title}` })
    .click();
  await page
    .getByRole("dialog", { name: "Supprimer le sondage" })
    .getByRole("button", { name: "Supprimer" })
    .click();
  await expect(link).toHaveCount(0);
  await page.goto(pollUrl);
  await expect(
    page.getByRole("heading", { name: "Ce sondage n'existe pas" }),
  ).toBeVisible();

  // signed out: the sign in form again
  await page.goto("/admin");
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page.getByLabel("Mot de passe administrateur")).toBeVisible();
  expect(
    (await page.context().cookies()).filter((c) => c.name === "kwikvote_admin"),
  ).toEqual([]);
});
