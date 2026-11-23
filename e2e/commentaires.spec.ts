import { checkA11y } from "./support/a11y";
import { nextWeekday } from "./support/dates";
import { expect, test } from "./support/fixtures";
import {
  createPoll,
  enableNotifications,
  uniqueName,
  vote,
} from "./support/poll";

// Comments of a poll: everyone sees them, the participants who enabled the
// notifications are told about the comments of the others.

const slots = [{ day: nextWeekday(6, 2), start: "15:00", end: "17:00" }];

test("participants comment, the others are notified", async ({
  page,
  participant,
}) => {
  // several participants, each in a browser of their own
  test.slow();
  const title = uniqueName("Apéro");
  await createPoll(page, { type: "free", title, slots });
  const pollUrl = page.url();

  const alice = await participant({ notifications: true });
  await alice.page.goto(pollUrl);
  await enableNotifications(alice.page);
  await vote(alice.page, slots, { name: "Alice", choices: ["Oui"] });

  const bob = await participant({ notifications: true });
  await bob.page.goto(pollUrl);
  await enableNotifications(bob.page);
  await vote(bob.page, slots, { name: "Bob", choices: ["Non"] });

  // carol hasn't voted nor enabled the notifications
  const carol = await participant();
  await carol.page.goto(pollUrl);
  await carol.page.getByRole("tab", { name: "Commentaires (0)" }).click();
  const comments = carol.page.getByRole("tabpanel", { name: /^Commentaires/ });

  // both fields are required
  await comments.getByRole("button", { name: "Envoyer" }).click();
  await expect(comments.getByLabel("Auteur")).toBeFocused();
  await expect(
    carol.page.getByRole("tab", { name: "Commentaires (0)" }),
  ).toBeVisible();

  await comments.getByLabel("Auteur").fill("Carol");
  await comments
    .getByLabel("Message")
    .fill("Je ramène les chips\net les olives");
  await comments.getByRole("button", { name: "Envoyer" }).click();
  await expect(
    carol.page.getByRole("tab", { name: "Commentaires (1)" }),
  ).toBeVisible();
  await expect(comments).toContainText("Je ramène les chips\net les olives");
  // the form is emptied for the next one
  await expect(comments.getByLabel("Message")).toHaveValue("");
  await checkA11y(carol.page, "comments");

  const expected = {
    title: "Nouveau commentaire !",
    body: `Il y a un nouveau commentaire de Carol sur le sondage ${title}`,
    link: `${pollUrl.split("?")[0]}?tab=comments`,
  };
  await expect.poll(() => alice.push!.notifications()).toEqual([expected]);
  await expect.poll(() => bob.push!.notifications()).toEqual([expected]);

  // alice answers: bob is told, not alice
  await alice.page.goto(expected.link);
  const aliceComments = alice.page.getByRole("tabpanel", {
    name: "Commentaires (1)",
  });
  await expect(aliceComments).toContainText("Je ramène les chips");
  await aliceComments.getByLabel("Auteur").fill("Alice");
  await aliceComments.getByLabel("Message").fill("Super !");
  await aliceComments.getByRole("button", { name: "Envoyer" }).click();
  await expect(
    alice.page.getByRole("tab", { name: "Commentaires (2)" }),
  ).toBeVisible();

  await expect
    .poll(async () => (await bob.push!.notifications()).map((n) => n.body))
    .toEqual([
      expected.body,
      expect.stringContaining("de Alice sur le sondage"),
    ]);
  expect(await alice.push!.notifications()).toHaveLength(1);

  // in order, for everyone
  await page.goto(`${pollUrl.split("?")[0]}?tab=comments`);
  const all = page.getByRole("tabpanel", { name: "Commentaires (2)" });
  await expect(all).toContainText(
    /Carol[\s\S]*Je ramène les chips[\s\S]*Alice[\s\S]*Super !/,
  );
});
