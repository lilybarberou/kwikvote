import { checkA11y } from "./support/a11y";
import { addDays, nextWeekday } from "./support/dates";
import { expect, test } from "./support/fixtures";
import {
  createPoll,
  enableNotifications,
  expectRegistrations,
  fillVoteDialog,
  openRegistration,
  submitVoteDialog,
  vote,
} from "./support/poll";

// The priority vote (docs/vote-prioritaire.md): registered on friday and
// saturday, waiting on saturday; saturday becomes the priority, the person
// takes the place on saturday and friday goes to the waiting list.

// far enough for the reregistrations not to be open yet (eve at 17:00)
const friday = nextWeekday(5, 3);
const saturday = addDays(friday, 1);
const slots = [
  { day: friday, start: "18:00", end: "20:00", maxParticipants: 1 },
  { day: saturday, start: "18:00", end: "20:00", maxParticipants: 1 },
];

test("saturday becomes the priority: the person takes the free place on saturday, friday goes to the next one", async ({
  page,
  participant,
}) => {
  // several participants, each in a browser of their own
  test.slow();
  await createPoll(page, { type: "registration", slots });
  const pollUrl = page.url();

  const alice = await participant({ notifications: true });
  await alice.page.goto(pollUrl);
  await enableNotifications(alice.page);
  await vote(alice.page, slots, { name: "Alice", choices: ["Oui", "Oui"] });
  // one confirmed place before the reregistrations open: the first one
  await expectRegistrations(alice.page, [
    { registered: ["Alice"], reregistered: [] },
    { registered: [], reregistered: ["Alice"] },
  ]);

  const bob = await participant({ notifications: true });
  await bob.page.goto(pollUrl);
  await enableNotifications(bob.page);
  await vote(bob.page, slots, { name: "Bob", choices: ["Oui", "Non"] });
  await expectRegistrations(bob.page, [
    { registered: ["Alice"], waitingList: ["Bob"] },
    { registered: [], notComing: ["Bob"] },
  ]);

  // the priority checkbox only shows on a yes
  await alice.page.reload();
  await openRegistration(alice.page, "Alice");
  const dialog = await fillVoteDialog(alice.page, slots, {
    choices: ["Oui", "Oui"],
    priorities: [1],
  });
  await checkA11y(alice.page, "vote dialog (registration)");
  await submitVoteDialog(alice.page);

  await expectRegistrations(alice.page, [
    { registered: ["Bob"], waitingList: [], reregistered: ["Alice"] },
    { registered: ["Alice (créneau prioritaire)"], reregistered: [] },
  ]);
  await expect(dialog).toBeHidden();

  // bob got the place of friday and is told so, alice (the author) is not
  await expect
    .poll(() => bob.push!.notifications())
    .toEqual([
      expect.objectContaining({
        title: "Vous êtes inscrit !",
        body: expect.stringMatching(
          /^Bonne nouvelle, vous avez intégré les inscrits du vendredi \d+ à 18:00 !$/,
        ),
        link: expect.stringContaining(new URL(pollUrl).pathname),
      }),
    ]);
  expect(await alice.push!.notifications()).toEqual([]);

  // the others see the same lists
  await page.reload();
  await expectRegistrations(page, [
    { registered: ["Bob"], reregistered: ["Alice"] },
    { registered: ["Alice (créneau prioritaire)"] },
  ]);
  await checkA11y(page, "registration poll");

  // removing the priority doesn't take friday back from bob: alice waits at
  // the end of its waiting list and keeps saturday
  await openRegistration(alice.page, "Alice");
  await fillVoteDialog(alice.page, slots, { priorities: [] });
  await submitVoteDialog(alice.page);
  await expectRegistrations(alice.page, [
    { registered: ["Bob"], waitingList: ["Alice"], reregistered: [] },
    { registered: ["Alice"], waitingList: [] },
  ]);
});

test("saturday is full: the person keeps friday and waits on saturday, then switches when a place frees up", async ({
  page,
  participant,
}) => {
  // several participants, each in a browser of their own
  test.slow();
  await createPoll(page, { type: "registration", slots });
  const pollUrl = page.url();

  const carol = await participant();
  await carol.page.goto(pollUrl);
  await vote(carol.page, slots, { name: "Carol", choices: ["Non", "Oui"] });

  const alice = await participant({ notifications: true });
  await alice.page.goto(pollUrl);
  await enableNotifications(alice.page);
  await vote(alice.page, slots, { name: "Alice", choices: ["Oui", "Oui"] });

  const bob = await participant({ notifications: true });
  await bob.page.goto(pollUrl);
  await enableNotifications(bob.page);
  await vote(bob.page, slots, { name: "Bob", choices: ["Oui", "Non"] });
  await expectRegistrations(bob.page, [
    { registered: ["Alice"], waitingList: ["Bob"] },
    { registered: ["Carol"], reregistered: ["Alice"] },
  ]);

  // saturday is full: no place is taken from carol, alice waits at the end of
  // its waiting list (not the reregistered one) and keeps friday
  await alice.page.reload();
  await openRegistration(alice.page, "Alice");
  await fillVoteDialog(alice.page, slots, { priorities: [1] });
  await submitVoteDialog(alice.page);
  await expectRegistrations(alice.page, [
    { registered: ["Alice"], waitingList: ["Bob"], reregistered: [] },
    {
      registered: ["Carol"],
      waitingList: ["Alice (créneau prioritaire)"],
      reregistered: [],
    },
  ]);

  // carol leaves: alice gets saturday, her friday goes to bob, both are told
  await carol.page.reload();
  await openRegistration(carol.page, "Carol");
  await carol.page.getByRole("button", { name: "Supprimer le vote" }).click();
  await expect(carol.page.getByRole("dialog")).toBeHidden();
  await expectRegistrations(carol.page, [
    { registered: ["Bob"], waitingList: [], reregistered: ["Alice"] },
    { registered: ["Alice (créneau prioritaire)"], waitingList: [] },
  ]);

  await expect
    .poll(async () => (await alice.push!.notifications()).map((n) => n.body))
    .toEqual([expect.stringMatching(/inscrits du samedi \d+ à 18:00 !$/)]);
  await expect
    .poll(async () => (await bob.push!.notifications()).map((n) => n.body))
    .toEqual([expect.stringMatching(/inscrits du vendredi \d+ à 18:00 !$/)]);
});
