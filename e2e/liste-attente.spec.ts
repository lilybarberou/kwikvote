import { addDays, nextWeekday, today } from "./support/dates";
import { Participant, expect, test } from "./support/fixtures";
import {
  createPoll,
  enableNotifications,
  expectRegistrations,
  fillVoteDialog,
  openRegistration,
  submitVoteDialog,
  vote,
} from "./support/poll";

// Waiting list of the registration polls: a place that frees up goes to the
// first person waiting, who gets a push notification.

test("a freed place goes to the first of the waiting list, in order, and they are notified", async ({
  page,
  participant,
}) => {
  // several participants, each in a browser of their own
  test.slow();
  const slots = [
    {
      day: nextWeekday(3, 3),
      start: "19:00",
      end: "21:00",
      maxParticipants: 2,
    },
  ];
  await createPoll(page, { type: "registration", slots });
  const pollUrl = page.url();

  const people: Record<string, Participant> = {};
  for (const name of ["Alice", "Bob", "Carol", "Dave"]) {
    people[name] = await participant({ notifications: true });
    await people[name].page.goto(pollUrl);
    await enableNotifications(people[name].page);
    await vote(people[name].page, slots, { name, choices: ["Oui"] });
  }
  await page.reload();
  await expectRegistrations(page, [
    { registered: ["Alice", "Bob"], waitingList: ["Carol", "Dave"] },
  ]);
  await expect(
    page.getByRole("row", { name: /^Inscrits/ }),
  ).toHaveAccessibleName("Inscrits 2/2");
  // for screen readers, each name is in a list, in the cell of its slot, in
  // the row of its list: they read it with its row and column headers
  await expect(page.getByRole("table")).toMatchAriaSnapshot(`
    - rowgroup:
      - row:
        - columnheader "Aide"
        - columnheader /\\d\\d\\/\\d\\d 19:00 - 21:00$/
    - rowgroup:
      - row "Inscrits 2/2":
        - rowheader "Inscrits"
        - cell "2/2"
      - row:
        - rowheader "Personnes inscrites"
        - cell:
          - list:
            - /children: equal
            - listitem:
              - button "Alice"
            - listitem:
              - button "Bob"
      - row "Liste d'attente 2":
        - rowheader "Liste d'attente"
        - cell "2"
      - row:
        - rowheader "Personnes en liste d'attente"
        - cell:
          - list:
            - /children: equal
            - listitem:
              - button "Carol"
            - listitem:
              - button "Dave"
  `);

  // changing only the name keeps the place in the queue
  const { page: carol } = people.Carol;
  await carol.reload();
  await openRegistration(carol, "Carol");
  await fillVoteDialog(carol, slots, { name: "Caroline" });
  await submitVoteDialog(carol);
  await expectRegistrations(carol, [
    { registered: ["Alice", "Bob"], waitingList: ["Caroline", "Dave"] },
  ]);

  // bob deletes his vote: the first waiting person gets his place
  const { page: bob } = people.Bob;
  await bob.reload();
  await openRegistration(bob, "Bob");
  await bob.getByRole("button", { name: "Supprimer le vote" }).click();
  await expect(bob.getByRole("dialog")).toBeHidden();
  await expectRegistrations(bob, [
    { registered: ["Alice", "Caroline"], waitingList: ["Dave"] },
  ]);
  await expect
    .poll(async () =>
      (await people.Carol.push!.notifications()).map((n) => n.title),
    )
    .toEqual(["Vous êtes inscrit !"]);

  // alice now says no: dave gets her place, she is in "Ne viennent pas"
  const { page: alice } = people.Alice;
  await alice.reload();
  await openRegistration(alice, "Alice");
  await fillVoteDialog(alice, slots, { choices: ["Non"] });
  await submitVoteDialog(alice);
  await expectRegistrations(alice, [
    { registered: ["Caroline", "Dave"], waitingList: [], notComing: ["Alice"] },
  ]);
  await expect
    .poll(async () => (await people.Dave.push!.notifications()).length)
    .toBe(1);

  // the people who didn't move are never notified (nor the authors)
  expect(await people.Alice.push!.notifications()).toEqual([]);
  expect(await people.Bob.push!.notifications()).toEqual([]);
  expect(await people.Carol.push!.notifications()).toHaveLength(1);

  // everyone sees the same lists after a reload; the "Ne viennent pas" of the
  // others are behind "Voir tout"
  await page.reload();
  await expectRegistrations(page, [
    { registered: ["Caroline", "Dave"], waitingList: [], notComing: [] },
  ]);
  await page.getByRole("checkbox", { name: "Voir tout" }).check();
  await expectRegistrations(page, [{ notComing: ["Alice"] }]);
});

test("before the reregistrations open, a person is registered on one slot only", async ({
  page,
  participant,
}) => {
  // reopening 1 hour before the start: far from now
  const day = nextWeekday(2, 7);
  const slots = [
    { day, start: "10:00", end: "12:00", maxParticipants: 5 },
    { day: addDays(day, 1), start: "10:00", end: "12:00", maxParticipants: 5 },
  ];
  await createPoll(page, { type: "registration", reopening: 1, slots });
  await expect(
    page.getByRole("row", { name: /^Liste d'attente réinscrits/ }),
  ).toHaveAccessibleName(
    /^Liste d'attente réinscrits \(inscrit à partir de 1h avant le début du créneau\)/,
  );

  const alice = await participant();
  await alice.page.goto(page.url());
  // a registration poll only knows yes and no
  await alice.page
    .getByRole("button", { name: "Nouvelle inscription" })
    .click();
  await alice.page.getByRole("combobox").first().click();
  await expect(alice.page.getByRole("option")).toHaveText(["Oui", "Non"]);
  await alice.page.keyboard.press("Escape");
  await alice.page.getByRole("button", { name: "Annuler" }).click();

  await vote(alice.page, slots, { name: "Alice", choices: ["Oui", "Oui"] });
  await expectRegistrations(alice.page, [
    { registered: ["Alice"], reregistered: [] },
    { registered: [], reregistered: ["Alice"] },
  ]);
});

test("once the reregistrations are open, a person is registered on every slot with a place", async ({
  page,
  participant,
}) => {
  // reopening 72 hours before the start: already passed for these slots
  const day = addDays(today(), 1);
  const slots = [
    { day, start: "10:00", end: "12:00", maxParticipants: 1 },
    { day: addDays(day, 1), start: "10:00", end: "12:00", maxParticipants: 1 },
  ];
  await createPoll(page, { type: "registration", reopening: 72, slots });

  const alice = await participant();
  await alice.page.goto(page.url());
  await vote(alice.page, slots, { name: "Alice", choices: ["Oui", "Oui"] });
  await expectRegistrations(alice.page, [
    { registered: ["Alice"], reregistered: [] },
    { registered: ["Alice"], reregistered: [] },
  ]);

  // full slots: the next person waits on both
  const bob = await participant();
  await bob.page.goto(page.url());
  await vote(bob.page, slots, { name: "Bob", choices: ["Oui", "Oui"] });
  await expectRegistrations(bob.page, [
    { registered: ["Alice"], waitingList: ["Bob"] },
    { registered: ["Alice"], waitingList: ["Bob"] },
  ]);
});
