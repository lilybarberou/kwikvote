import { nextWeekday } from "./support/dates";
import { expect, test } from "./support/fixtures";
import { createPoll } from "./support/poll";

// The password of a poll can't be guessed: after 10 failures from the same
// address, even the right one is refused for 15 minutes, and it is said.
// (A poll of its own: the limits of the other journeys are not touched.)

test("too many wrong poll passwords: refused for a while, and said so", async ({
  page,
}) => {
  await createPoll(page, {
    type: "free",
    password: "le-bon",
    slots: [{ day: nextWeekday(3, 3), start: "12:00", end: "13:00" }],
  });
  await page.getByRole("button", { name: "Paramètres du sondage" }).click();
  const settings = page.getByRole("dialog", { name: "Paramètres du sondage" });
  const password = settings.getByLabel("Mot de passe");
  const submit = settings.getByRole("button", { name: "Valider" });

  for (let i = 0; i < 10; i++) {
    await password.fill(`faux-${i}`);
    await submit.click();
    await expect(password).toHaveAccessibleDescription(
      "Mot de passe incorrect",
    );
    // the next attempt starts without the previous message
    await expect(submit).toBeEnabled();
  }

  await password.fill("le-bon");
  await submit.click();
  await expect(password).toHaveAccessibleDescription(
    "Trop d'essais, réessayez dans 15 minutes",
  );
  await expect(
    settings.getByRole("button", { name: "Gérer le sondage" }),
  ).toHaveCount(0);
});
