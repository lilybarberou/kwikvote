import { addDays, nextWeekday } from "./support/dates";
import { Participant, expect, test } from "./support/fixtures";
import {
  createPoll,
  expectRegistrations,
  fillVoteDialog,
  openRegistration,
  vote,
  waitForRegistrationTable,
} from "./support/poll";

// Several participants confirming at the same moment on an almost full slot:
// the votes are serialized by the poll lock, the limit is never exceeded.

// many browser contexts per test
test.slow();

const slots = [
  { day: nextWeekday(4, 3), start: "20:00", end: "22:00", maxParticipants: 3 },
];
const RACERS = 8;

// opens the vote dialog of every participant and fills it, then confirms
// them all at once
const confirmTogether = async (
  forms: { page: Participant["page"]; name: string }[],
) => {
  for (const { page, name } of forms) {
    await page.getByRole("button", { name: "Nouvelle inscription" }).click();
    await fillVoteDialog(page, slots, { name, choices: ["Oui"] });
  }
  const confirms = forms.map(({ page }) =>
    page.getByRole("dialog").getByRole("button", { name: "Confirmer" }),
  );
  await Promise.all(confirms.map((confirm) => confirm.click()));
  // every vote is saved: no "poll busy" error left a dialog open
  await Promise.all(
    forms.map(({ page }) => expect(page.getByRole("dialog")).toBeHidden()),
  );
};

const checkInvariants = async (page: Participant["page"], names: string[]) => {
  await page.reload();
  const [slot] = await waitForRegistrationTable(page, 1);
  expect(slot.registered.length).toBeLessThanOrEqual(3);
  expect(slot.count).toBe(`${slot.registered.length}/3`);
  // everyone is in exactly one list
  expect([...slot.registered, ...slot.waitingList].sort()).toEqual(
    [...names].sort(),
  );
  // no free place while people wait
  if (slot.waitingList.length) expect(slot.registered).toHaveLength(3);
  return slot;
};

test(`${RACERS} participants confirm at the same time for the last place`, async ({
  page,
  participant,
}) => {
  await createPoll(page, { type: "registration", slots });
  const pollUrl = page.url();
  await vote(page, slots, { name: "Alice", choices: ["Oui"] });
  await vote(page, slots, { name: "Bob", choices: ["Oui"] });

  const racers = await Promise.all(
    Array.from({ length: RACERS }, async (_, index) => {
      const { page } = await participant();
      await page.goto(pollUrl);
      return { page, name: `Coureur ${index + 1}` };
    }),
  );
  await confirmTogether(racers);

  const slot = await checkInvariants(page, [
    "Alice",
    "Bob",
    ...racers.map(({ name }) => name),
  ]);
  expect(slot.registered.slice(0, 2)).toEqual(["Alice", "Bob"]);
  expect(slot.registered).toHaveLength(3);
  expect(slot.waitingList).toHaveLength(RACERS - 1);
});

test("a place freed while others confirm goes to one of them only", async ({
  page,
  participant,
}) => {
  await createPoll(page, { type: "registration", slots });
  const pollUrl = page.url();
  for (const name of ["Alice", "Bob", "Carol"])
    await vote(page, slots, { name, choices: ["Oui"] });

  const leaving = await participant();
  await leaving.page.goto(pollUrl);
  // a context that didn't vote can still change anyone's vote
  await openRegistration(leaving.page, "Bob");

  const racers = await Promise.all(
    Array.from({ length: 5 }, async (_, index) => {
      const { page } = await participant();
      await page.goto(pollUrl);
      return { page, name: `Coureur ${index + 1}` };
    }),
  );
  for (const { page, name } of racers) {
    await page.getByRole("button", { name: "Nouvelle inscription" }).click();
    await fillVoteDialog(page, slots, { name, choices: ["Oui"] });
  }
  await Promise.all([
    leaving.page.getByRole("button", { name: "Supprimer le vote" }).click(),
    ...racers.map(({ page }) =>
      page
        .getByRole("dialog")
        .getByRole("button", { name: "Confirmer" })
        .click(),
    ),
  ]);
  await Promise.all(
    [leaving, ...racers].map(({ page }) =>
      expect(page.getByRole("dialog")).toBeHidden(),
    ),
  );

  const slot = await checkInvariants(page, [
    "Alice",
    "Carol",
    ...racers.map(({ name }) => name),
  ]);
  expect(slot.registered).toHaveLength(3);
  expect(slot.registered.slice(0, 2)).toEqual(["Alice", "Carol"]);
  expect(slot.waitingList).toHaveLength(4);
  await expectRegistrations(page, [{ registered: slot.registered }]);
});

test("two people make saturday their priority at the same time for its last place", async ({
  page,
  participant,
}) => {
  const friday = nextWeekday(5, 3);
  const weekend = [
    { day: friday, start: "18:00", end: "20:00", maxParticipants: 2 },
    {
      day: addDays(friday, 1),
      start: "18:00",
      end: "20:00",
      maxParticipants: 1,
    },
  ];
  await createPoll(page, { type: "registration", slots: weekend });
  const pollUrl = page.url();

  const people = await Promise.all(
    ["Alice", "Bob"].map(async (name) => {
      const { page } = await participant();
      await page.goto(pollUrl);
      return { page, name };
    }),
  );
  for (const { page, name } of people)
    await vote(page, weekend, { name, choices: ["Oui", "Oui"] });
  for (const { page, name } of people) {
    await page.reload();
    await openRegistration(page, name);
    await fillVoteDialog(page, weekend, { priorities: [1] });
  }
  await Promise.all(
    people.map(({ page }) =>
      page
        .getByRole("dialog")
        .getByRole("button", { name: "Confirmer" })
        .click(),
    ),
  );
  await Promise.all(
    people.map(({ page }) => expect(page.getByRole("dialog")).toBeHidden()),
  );

  // one gets saturday, the other keeps friday and waits on saturday
  await page.reload();
  const [fri, sat] = await waitForRegistrationTable(page, 2);
  expect(sat.registered).toHaveLength(1);
  const winner = sat.registered[0].replace(" (créneau prioritaire)", "");
  const loser = winner === "Alice" ? "Bob" : "Alice";
  expect({ fri, sat }).toMatchObject({
    fri: { registered: [loser], reregistered: [winner] },
    sat: { waitingList: [`${loser} (créneau prioritaire)`], reregistered: [] },
  });
});
