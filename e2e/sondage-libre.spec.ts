import { checkA11y } from "./support/a11y";
import { addDays, nextWeekday } from "./support/dates";
import { expect, test } from "./support/fixtures";
import {
  createPoll,
  fillVoteDialog,
  readFreePollTable,
  submitVoteDialog,
  vote,
} from "./support/poll";

// Free polls: yes / no / don't know, no limit of participants.

const day = nextWeekday(1, 2);
const slots = [
  { day, start: "12:00", end: "14:00" },
  { day, start: "19:00", end: "21:00" },
  { day: addDays(day, 1), start: "12:00", end: "14:00" },
];

test("participants vote, change and delete their votes", async ({
  page,
  participant,
}) => {
  // several participants, each in a browser of their own
  test.slow();
  await createPoll(page, { type: "free", slots });
  const pollUrl = page.url();
  await checkA11y(page, "free poll (empty)");

  const alice = await participant();
  await alice.page.goto(pollUrl);
  await vote(alice.page, slots, {
    name: "Alice",
    choices: ["Oui", "Non", "Ne sais pas"],
  });
  await checkA11y(alice.page, "free poll");

  const bob = await participant();
  await bob.page.goto(pollUrl);
  await vote(bob.page, slots, { name: "Bob", choices: ["Oui", "Oui", "Non"] });

  await page.reload();
  await expect
    .poll(() => readFreePollTable(page))
    .toEqual({
      total: "Total 2 votants",
      totals: ["2 Oui", "1 Oui", "0 Oui 1 Ne sais pas"],
      votes: [
        { name: "Alice", choices: ["Oui", "Non", "Ne sais pas"] },
        { name: "Bob", choices: ["Oui", "Oui", "Non"] },
      ],
    });

  // a vote is changed from its row, by its author or anyone else
  await alice.page.reload();
  await alice.page
    .getByRole("button", { name: "Modifier le vote de Alice" })
    .click();
  await expect(
    alice.page.getByRole("dialog", { name: "Modifier un vote" }),
  ).toBeVisible();
  await fillVoteDialog(alice.page, slots, {
    name: "Alice B.",
    choices: ["Oui", "Oui", "Oui"],
  });
  await submitVoteDialog(alice.page);
  await alice.page.reload();
  await expect
    .poll(async () => (await readFreePollTable(alice.page))?.votes[0])
    .toEqual({ name: "Alice B.", choices: ["Oui", "Oui", "Oui"] });

  // only the name: the choices are kept
  await alice.page
    .getByRole("button", { name: "Modifier le vote de Alice B." })
    .click();
  await fillVoteDialog(alice.page, slots, { name: "Alice" });
  await submitVoteDialog(alice.page);
  await expect(
    alice.page.getByRole("rowheader", { name: "Alice", exact: true }),
  ).toBeVisible();

  // deleted: gone for everyone
  await bob.page.reload();
  await bob.page
    .getByRole("button", { name: "Modifier le vote de Bob" })
    .click();
  await bob.page.getByRole("button", { name: "Supprimer le vote" }).click();
  await expect(bob.page.getByRole("dialog")).toBeHidden();
  await page.reload();
  await expect
    .poll(() => readFreePollTable(page))
    .toEqual({
      total: "Total 1 votants",
      totals: ["1 Oui", "1 Oui", "1 Oui"],
      votes: [{ name: "Alice", choices: ["Oui", "Oui", "Oui"] }],
    });
});

test("a vote needs a name and a choice for every slot", async ({ page }) => {
  await createPoll(page, { type: "free", slots });
  await page.getByRole("button", { name: "Nouveau vote" }).click();
  const dialog = page.getByRole("dialog", { name: "Ajouter un vote" });
  await fillVoteDialog(page, slots, { choices: ["Oui"] });
  // no priority on a free poll
  await expect(dialog.getByRole("checkbox")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Confirmer" }).click();

  // the errors are linked to their fields
  await expect(dialog.getByLabel("Nom")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(dialog.getByLabel("Nom")).toHaveAccessibleDescription(
    "Champ requis",
  );
  const second = dialog.getByRole("combobox", { name: /^Choix – .* 19:00$/ });
  await expect(second).toHaveAccessibleDescription("Champ requis");
  await checkA11y(page, "vote dialog with errors");

  await fillVoteDialog(page, slots, {
    name: "Zoé",
    choices: ["Oui", "Non", "Oui"],
  });
  await submitVoteDialog(page);
  await expect(page.getByRole("rowheader", { name: "Zoé" })).toBeVisible();
});
