import { checkA11y } from "./support/a11y";
import { addDays, nextWeekday, slotDayLabel } from "./support/dates";
import { expect, test } from "./support/fixtures";
import { createPoll, uniqueName } from "./support/poll";
import { getDiscordMessages } from "./support/push";

// Creation of the polls of each type, then finding them again.

const day = nextWeekday(4, 2);

test("a free poll: title, description, slots on one or two days, found again by email", async ({
  page,
}) => {
  await page.goto("/");
  await checkA11y(page, "home");
  await page.getByRole("link", { name: "Créer un sondage" }).first().click();
  await expect(
    page.getByRole("heading", { name: "Création du sondage" }),
  ).toBeVisible();
  await checkA11y(page, "creation form");

  const title = uniqueName("Pique-nique");
  const email = `${uniqueName("e2e").replace(" ", "-")}@Example.com`;
  const pollId = await createPoll(page, {
    type: "free",
    title,
    description: "Apportez à boire",
    email,
    slots: [
      { day, start: "12:00", end: "14:00" },
      // ends the next day
      {
        day: addDays(day, 1),
        start: "22:00",
        endDay: addDays(day, 2),
        end: "02:00",
      },
    ],
  });

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(page.getByText("Apportez à boire")).toBeVisible();
  const headers = page.getByRole("columnheader");
  await expect(headers.nth(1)).toHaveAccessibleName(
    `${slotDayLabel(day)} 12:00 - 14:00`,
  );
  await expect(headers.nth(2)).toHaveAccessibleName(
    `${slotDayLabel(addDays(day, 1))} 22:00 ${slotDayLabel(addDays(day, 2))} 02:00`,
  );
  // no reregistration settings on a free poll
  await expect(page.getByRole("row", { name: /^Inscrits/ })).toHaveCount(0);

  // the team is told on Discord (the fake webhook of the suite)
  await expect
    .poll(async () =>
      (await getDiscordMessages()).find(
        (message) => message.embeds[0].title === `Nouveau sondage "${title}"`,
      ),
    )
    .toEqual({
      embeds: [
        {
          title: `Nouveau sondage "${title}"`,
          description: email.toLowerCase(),
          fields: [
            { name: "Lien", value: expect.stringContaining(`/poll/${pollId}`) },
          ],
        },
      ],
    });

  // "Mes sondages": the email, whatever its case
  await page.getByRole("link", { name: "Mes sondages" }).click();
  await page.getByLabel("Votre email").fill(email.toUpperCase());
  await page.getByRole("button", { name: "Rechercher" }).click();
  await expect(page.getByRole("link", { name: title })).toHaveAttribute(
    "href",
    `/poll/${pollId}`,
  );
  await checkA11y(page, "my polls");
  await page.getByRole("link", { name: title }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
});

test("the link of the new poll is copied", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/poll/creer");
  await page.getByLabel("Titre du sondage").fill(uniqueName("Lien"));
  await page.getByRole("button", { name: "Créer" }).click();
  const created = page.getByRole("alertdialog", { name: "Sondage créé !" });
  await created.getByRole("button", { name: "Copier le lien" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Lien copié" }),
  ).toBeVisible();
  const url = page.url().split("?")[0];
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);
  await checkA11y(page, "poll created dialog");
  await created.getByRole("button", { name: "Fermer" }).click();
  // closed for good: not shown again on reload
  await expect(page).toHaveURL(url);
  await page.reload();
  await expect(created).toBeHidden();
});

test("a registration poll: a limit per slot and the reopening time", async ({
  page,
}) => {
  await createPoll(page, {
    type: "registration",
    reopening: 5,
    slots: [
      { day, start: "09:00", end: "10:00", maxParticipants: 3 },
      { day, start: "10:00", end: "11:00", maxParticipants: 12 },
    ],
  });
  await expect(
    page.getByRole("row", { name: /^Inscrits/ }),
  ).toHaveAccessibleName("Inscrits 0/3 0/12");
  await expect(
    page.getByRole("row", { name: /^Liste d'attente réinscrits/ }),
  ).toHaveAccessibleName(
    "Liste d'attente réinscrits (inscrit à partir de 5h avant le début du créneau) 0 0",
  );

  // the help explains the lists
  await page.getByRole("button", { name: "Aide" }).click();
  const help = page.getByRole("dialog", { name: "Aide" });
  await expect(help).toContainText(
    "Vous passez en inscrit dès qu'une place se libère.",
  );
  await checkA11y(page, "registration poll help");
  await help.getByRole("button", { name: "Fermer" }).click();

  // default reopening: the eve at 17:00
  await createPoll(page, {
    type: "registration",
    slots: [{ day, start: "09:00", end: "10:00", maxParticipants: 1 }],
  });
  await expect(
    page.getByRole("row", { name: /^Liste d'attente réinscrits/ }),
  ).toHaveAccessibleName(
    "Liste d'attente réinscrits (inscrit à partir de la veille à 17h) 0",
  );
});

test("the creation form refuses a missing title, an invalid email, limit or slot", async ({
  page,
}) => {
  await page.goto("/poll/creer");
  await page.getByText("Sondage avec liste d'attente", { exact: true }).click();
  await page.getByLabel("Email").fill("pas-un-email");
  await page.getByLabel("Maximum de participants").fill("0");
  await page.getByRole("button", { name: "Créer" }).click();

  await expect(page.getByLabel("Titre du sondage")).toHaveAccessibleDescription(
    "Champ requis",
  );
  await expect(page.getByLabel("Email")).toHaveAccessibleDescription(
    "Email invalide",
  );
  await expect(
    page.getByLabel("Maximum de participants"),
  ).toHaveAccessibleDescription("Nombre invalide");
  // a slot can't end before it starts
  await page.getByLabel("Heure de début").fill("22:00");
  await page.getByLabel("Heure de fin").fill("02:00");
  await page.getByRole("button", { name: "Créer" }).click();
  await expect(page.getByLabel("Heure de fin")).toHaveAccessibleDescription(
    "La fin du créneau doit être après son début",
  );
  await checkA11y(page, "creation form with errors");
  await expect(page).toHaveURL(/\/poll\/creer$/);

  // fixed: the poll is created
  await page.getByLabel("Titre du sondage").fill(uniqueName("Corrigé"));
  await page.getByLabel("Email").fill("");
  await page.getByLabel("Maximum de participants").fill("4");
  await page.getByLabel("Heure de fin").fill("23:30");
  await page.getByRole("button", { name: "Créer" }).click();
  await expect(
    page.getByRole("alertdialog", { name: "Sondage créé !" }),
  ).toBeVisible();
});

test("an unknown poll", async ({ page }) => {
  await page.goto("/poll/00000000-0000-4000-8000-000000000000");
  await expect(
    page.getByRole("heading", { name: "Ce sondage n'existe pas" }),
  ).toBeVisible();
  await checkA11y(page, "unknown poll");
  await page.getByRole("link", { name: "page de création" }).click();
  await expect(page).toHaveURL(/\/poll\/creer$/);
});
