import { Page } from "@playwright/test";

import { Day, addDays, nextWeekday } from "./support/dates";
import { db, getStoredChoices } from "./support/db";
import { expect, test } from "./support/fixtures";
import {
  Choice,
  createPoll,
  fillVoteDialog,
  openRegistration,
  slotLabel,
  submitVoteDialog,
  vote,
  voteDialog,
} from "./support/poll";

// The vote form shows the vote it opens, and only that one. With
// react-hook-form 7.92, it showed the choices and priorities of the vote
// opened before, and confirming saved them on the other vote; a vote opened
// right after its creation showed "À définir" everywhere.

test.afterAll(() => db.$disconnect());

// far enough for the reregistrations not to be open yet (eve at 17:00)
const friday = nextWeekday(5, 3);
const slots: {
  day: Day;
  start: string;
  end: string;
  maxParticipants: number;
}[] = [
  { day: friday, start: "18:00", end: "20:00", maxParticipants: 5 },
  { day: addDays(friday, 1), start: "18:00", end: "20:00", maxParticipants: 5 },
];

type ShownVote = {
  name: string;
  choices: (Choice | "À définir")[];
  // registration polls: null when the checkbox isn't shown (not a yes)
  priorities?: (boolean | null)[];
};

const expectVoteDialog = async (page: Page, expected: ShownVote) => {
  const dialog = voteDialog(page);
  await expect(dialog.getByLabel("Nom")).toHaveValue(expected.name);
  for (const [index, slot] of slots.entries()) {
    await expect(
      dialog.getByRole("combobox", { name: `Choix – ${slotLabel(slot)}` }),
    ).toHaveText(expected.choices[index]);
    if (!expected.priorities) continue;
    const priority = dialog.getByRole("checkbox", {
      name: `Prioritaire – ${slotLabel(slot)}`,
    });
    if (expected.priorities[index] === null)
      await expect(priority).toBeHidden();
    else
      await expect(priority).toBeChecked({
        checked: expected.priorities[index],
      });
  }
};

const cancelVoteDialog = async (page: Page) => {
  const dialog = voteDialog(page);
  await dialog.getByRole("button", { name: "Annuler" }).click();
  await expect(dialog).toBeHidden();
};

for (const type of ["free", "registration"] as const) {
  const isRegistration = type === "registration";
  const openVote = async (page: Page, name: string) => {
    if (isRegistration) return openRegistration(page, name);
    await page
      .getByRole("button", { name: `Modifier le vote de ${name}` })
      .click();
    await expect(voteDialog(page)).toHaveAccessibleName("Modifier un vote");
  };

  test(`${type} poll: the vote form shows and keeps the choices of the opened vote`, async ({
    page,
  }) => {
    const pollId = await createPoll(page, { type, slots });

    await vote(page, slots, { name: "Xavier", choices: ["Oui", "Non"] });
    await vote(page, slots, {
      name: "Lily",
      choices: isRegistration ? ["Oui", "Oui"] : ["Non", "Ne sais pas"],
      priorities: isRegistration ? [1] : undefined,
    });
    const xavier: ShownVote = {
      name: "Xavier",
      choices: ["Oui", "Non"],
      priorities: isRegistration ? [false, null] : undefined,
    };
    const lily: ShownVote = {
      name: "Lily",
      choices: isRegistration ? ["Oui", "Oui"] : ["Non", "Ne sais pas"],
      priorities: isRegistration ? [false, true] : undefined,
    };
    const storedXavier = [
      { choice: 1, priority: false },
      { choice: 2, priority: false },
    ];
    expect(await getStoredChoices(pollId, "Xavier")).toEqual(storedXavier);

    // the votes as loaded from the server
    await page.reload();

    // A, closed, then B: B is shown, not A
    await openVote(page, "Lily");
    await expectVoteDialog(page, lily);
    await cancelVoteDialog(page);
    await openVote(page, "Xavier");
    await expectVoteDialog(page, xavier);

    // a change cancelled is not shown when the vote is opened again
    await fillVoteDialog(page, slots, { choices: ["Non", "Oui"] });
    await cancelVoteDialog(page);
    await openVote(page, "Xavier");
    await expectVoteDialog(page, xavier);

    // only the name changes: the stored choices are kept
    await fillVoteDialog(page, slots, { name: "Xavier B." });
    await submitVoteDialog(page);
    await expect
      .poll(() => getStoredChoices(pollId, "Xavier B."))
      .toEqual(storedXavier);
    expect(await getStoredChoices(pollId, "Lily")).toEqual(
      isRegistration
        ? [
            { choice: 1, priority: false },
            { choice: 1, priority: true },
          ]
        : [
            { choice: 2, priority: false },
            { choice: 3, priority: false },
          ],
    );

    // a vote opened again right after its creation, without a reload
    const zoe: ShownVote = {
      name: "Zoé",
      choices: isRegistration ? ["Non", "Oui"] : ["Ne sais pas", "Oui"],
      priorities: isRegistration ? [null, true] : undefined,
    };
    await vote(page, slots, {
      name: zoe.name,
      choices: zoe.choices as Choice[],
      priorities: isRegistration ? [1] : undefined,
    });
    await openVote(page, "Zoé");
    await expectVoteDialog(page, zoe);
    // and a new vote starts empty, after it
    await cancelVoteDialog(page);
    await page
      .getByRole("button", { name: /^(Nouveau vote|Nouvelle inscription)$/ })
      .click();
    await expectVoteDialog(page, {
      name: "",
      choices: ["À définir", "À définir"],
      priorities: isRegistration ? [null, null] : undefined,
    });
  });
}
