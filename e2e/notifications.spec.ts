import { checkA11y } from "./support/a11y";
import { nextWeekday, slotDayLabel } from "./support/dates";
import { expect, test } from "./support/fixtures";
import {
  createPoll,
  enableNotifications,
  expectRegistrations,
  uniqueName,
  vote,
} from "./support/poll";

// Subscribing to the notifications (simulated push, see browser-mocks.ts)

const day = nextWeekday(2, 3);
const slots = [{ day, start: "18:00", end: "20:00", maxParticipants: 4 }];

test("the notification prompt: no thanks is remembered, the bell subscribes later", async ({
  page,
  participant,
}) => {
  await createPoll(page, { type: "registration", slots });
  const pollUrl = page.url();

  const alice = await participant({ notifications: true });
  await alice.page.goto(pollUrl);
  const prompt = alice.page.getByText(
    "Vous recevrez une notification lorsqu'un nouveau commentaire sera posté, ainsi que pour être prévenu de votre inscription lorsque vous êtes en liste d'attente.",
  );
  await expect(prompt).toBeVisible();
  await checkA11y(alice.page, "poll with the notification prompt");
  await alice.page.getByRole("button", { name: "Non merci" }).click();
  await expect(prompt).toBeHidden();
  await alice.page.reload();
  await expect(alice.page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(prompt).toBeHidden();

  // the bell still offers it
  await enableNotifications(alice.page);
  const bell = alice.page.getByRole("button", { name: "Notifications" });
  await bell.click();
  await expect(
    alice.page.getByText(
      "En attente de votre vote pour activer les notifications sur ce sondage",
    ),
  ).toBeVisible();
  await alice.page.keyboard.press("Escape");

  // the subscription goes with the vote
  await vote(alice.page, slots, { name: "Alice", choices: ["Oui"] });
  await bell.click();
  await expect(
    alice.page.getByText("Notifications activées pour ce sondage"),
  ).toBeVisible();
  await alice.page.keyboard.press("Escape");
  await expect(
    alice.page.getByText("Votes pour lesquels vous recevez les notifications"),
  ).toBeVisible();

  // kept after a reload (the browser subscription and the server link)
  await alice.page.reload();
  await bell.click();
  await expect(
    alice.page.getByText("Notifications activées pour ce sondage"),
  ).toBeVisible();
});

test("the prompt subscribes too, and a moved slot is announced to the subscribers", async ({
  page,
  participant,
}) => {
  const title = uniqueName("Répétition");
  await createPoll(page, {
    type: "registration",
    title,
    password: "secret",
    slots,
  });
  const pollUrl = page.url();

  const alice = await participant({ notifications: true });
  await alice.page.goto(pollUrl);
  await alice.page
    .getByRole("button", { name: "Activer", exact: true })
    .click();
  await expect(
    alice.page
      .getByRole("status")
      .filter({ hasText: "Notifications activées" }),
  ).toBeVisible();
  await vote(alice.page, slots, { name: "Alice", choices: ["Oui"] });

  // the author moves the slot one hour later
  await page.getByRole("button", { name: "Paramètres du sondage" }).click();
  const settings = page.getByRole("dialog", { name: "Paramètres du sondage" });
  await settings.getByLabel("Mot de passe").fill("secret");
  await settings.getByRole("button", { name: "Valider" }).click();
  await settings.getByRole("button", { name: "Gérer les créneaux" }).click();
  await settings
    .getByRole("button", {
      name: `Modifier le créneau du ${slotDayLabel(day)} 18:00`,
    })
    .click();
  const edit = page.getByRole("dialog", { name: "Modifier le créneau" });
  await edit.getByLabel("Heure de début").fill("19:00");
  await edit.getByLabel("Heure de fin").fill("21:00");
  await checkA11y(page, "slot edition");
  await edit.getByRole("button", { name: "Enregistrer" }).click();
  await expect(edit).toBeHidden();

  const dayName = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(Date.UTC(day.year, day.month - 1, day.day)));
  await expect
    .poll(() => alice.push!.notifications())
    .toEqual([
      {
        title: "Changement d'horaire",
        body: `Le créneau du ${dayName} à 18:00 du sondage ${title} a changé : ${dayName} de 19:00 à 21:00.`,
        link: expect.stringMatching(/\?tab=votes&slot=[0-9a-f-]{36}$/),
      },
    ]);
});

test("a browser finds its votes by its subscription, whose endpoint the server never sends", async ({
  page,
  participant,
}) => {
  await createPoll(page, { type: "registration", slots });
  const pollUrl = page.url();

  const alice = await participant({ notifications: true });
  // the responses of the server actions (getPollById among them)
  const responses: Promise<string>[] = [];
  alice.page.on("response", (response) => {
    if (response.request().headers()["next-action"])
      responses.push(response.text().catch(() => ""));
  });
  await alice.page.goto(pollUrl);
  await enableNotifications(alice.page);
  await vote(alice.page, slots, { name: "Alice", choices: ["Non"] });

  const bob = await participant();
  await bob.page.goto(pollUrl);
  await vote(bob.page, slots, { name: "Bob", choices: ["Non"] });

  // "Ne viennent pas" only lists the votes of this browser: without its local
  // votes, alice still finds hers by its subscription
  await alice.page.evaluate(() => localStorage.removeItem("local-votes"));
  await alice.page.reload();
  await expectRegistrations(alice.page, [{ notComing: ["Alice"] }]);
  await expectRegistrations(bob.page, [{ notComing: ["Bob"] }]);
  await page.reload();
  await expectRegistrations(page, [{ notComing: [] }]);

  const bodies = await Promise.all(responses);
  expect(bodies.length).toBeGreaterThan(0);
  for (const body of bodies) expect(body).not.toContain(alice.push!.endpoint);
});
