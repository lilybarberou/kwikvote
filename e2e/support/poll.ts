import { Locator, Page, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

import {
  Day,
  FRENCH_MONTHS,
  calendarMonthLabel,
  monthsBetween,
  slotDayLabel,
} from "./dates";

// Journeys of the app, through its accessible names only (roles, labels).

export type SlotInput = {
  day: Day;
  start: string; // "18:00", Paris time
  // the same day by default
  endDay?: Day;
  end: string;
  // registration polls only
  maxParticipants?: number;
};

export type PollInput = {
  type: "free" | "registration";
  title?: string;
  description?: string;
  email?: string;
  password?: string;
  // registration polls: when the reregistered people can be registered,
  // "eve" = the day before at 17:00 (default), a number = hours before the start
  reopening?: "eve" | number;
  slots: SlotInput[];
};

// unique data per test: the tests share the database and run in parallel
export const uniqueName = (prefix: string) =>
  `${prefix} ${randomUUID().slice(0, 8)}`;

const pickDay = async (page: Page, button: Locator, day: Day) => {
  await button.click();
  await pickInOpenCalendar(page, day);
};

// picks a day in the open calendar of a date field
export const pickInOpenCalendar = async (page: Page, day: Day) => {
  const calendar = page.getByRole("dialog", { name: /^Date de (début|fin)$/ });
  // the calendar opens on the month of the current value of the field; its
  // grid is named after the month shown ("novembre 2026")
  const grid = calendar.getByRole("grid");
  const shown = /grid "([^"]+)"/.exec(await grid.ariaSnapshot())![1];
  const [monthName, year] = shown.trim().split(" ");
  const offset = monthsBetween(
    { year: Number(year), month: FRENCH_MONTHS.indexOf(monthName) + 1, day: 1 },
    day,
  );
  const button =
    offset > 0 ? "Aller au mois suivant" : "Aller au mois précédent";
  for (let i = 0; i < Math.abs(offset); i++)
    await calendar.getByRole("button", { name: button }).click();
  await expect(grid).toHaveAccessibleName(calendarMonthLabel(day));
  // the days are named by their number only: not one of the days of the
  // other months the grid also shows
  await grid
    .getByRole("gridcell", { name: String(day.day), exact: true })
    .and(page.locator(":not(.day-outside)"))
    .click();
  await expect(calendar).toBeHidden();
};

// creates a poll with the creation form, closes the "poll created" dialog and
// returns the poll id (the page stays on the poll)
export const createPoll = async (page: Page, poll: PollInput) => {
  await page.goto("/poll/creer");
  // the radio is visually hidden behind its card (sr-only): click the card
  const type =
    poll.type === "free" ? "Sondage libre" : "Sondage avec liste d'attente";
  await page.getByText(type, { exact: true }).click();
  await expect(page.getByRole("radio", { name: type })).toBeChecked();
  await page
    .getByLabel("Titre du sondage")
    .fill(poll.title ?? uniqueName("Sondage"));
  if (poll.description)
    await page.getByLabel("Description").fill(poll.description);
  if (poll.email) await page.getByLabel("Email").fill(poll.email);
  if (poll.password) await page.getByLabel("Mot de passe").fill(poll.password);

  if (poll.type === "registration" && typeof poll.reopening === "number") {
    await page
      .getByRole("spinbutton", {
        name: "Nombre d'heures avant la date de début",
      })
      .fill(String(poll.reopening));
    await expect(
      page.getByRole("radio", { name: /h avant la date de début/ }),
    ).toBeChecked();
  }

  for (const [index, slot] of poll.slots.entries()) {
    if (index > 0)
      await page.getByRole("button", { name: "Ajouter un créneau" }).click();
    await pickDay(
      page,
      page.getByRole("button", { name: /^Date de début/ }).nth(index),
      slot.day,
    );
    await page.getByLabel("Heure de début").nth(index).fill(slot.start);
    await pickDay(
      page,
      page.getByRole("button", { name: /^Date de fin/ }).nth(index),
      slot.endDay ?? slot.day,
    );
    await page.getByLabel("Heure de fin").nth(index).fill(slot.end);
    if (poll.type === "registration")
      await page
        .getByLabel("Maximum de participants")
        .nth(index)
        .fill(String(slot.maxParticipants ?? 10));
  }

  await page.getByRole("button", { name: "Créer" }).click();
  await page.waitForURL(/\/poll\/[0-9a-f-]{36}\?created=true$/);
  const created = page.getByRole("alertdialog", { name: "Sondage créé !" });
  await expect(created).toBeVisible();
  await created.getByRole("button", { name: "Fermer" }).click();
  await expect(created).toBeHidden();

  return new URL(page.url()).pathname.split("/").pop()!;
};

// "vendredi 20/11 18:00", the slot names of the vote form
export const slotLabel = (slot: { day: Day; start: string }) =>
  `${slotDayLabel(slot.day)} ${slot.start}`;

export type Choice = "Oui" | "Non" | "Ne sais pas";

export type VoteInput = {
  name: string;
  // one per slot, in the order of the slots
  choices: Choice[];
  // registration polls: indexes of the slots marked "Prioritaire"
  priorities?: number[];
};

const voteDialog = (page: Page) =>
  page.getByRole("dialog", {
    name: /^(Ajouter|Modifier) (un vote|une inscription)$/,
  });

const choose = async (page: Page, select: Locator, choice: Choice) => {
  const current = (await select.textContent())?.trim();
  if (current === choice) return;
  await select.click();
  await page.getByRole("option", { name: choice, exact: true }).click();
  await expect(select).toHaveText(choice);
};

// fills the open vote dialog (new or existing vote)
export const fillVoteDialog = async (
  page: Page,
  slots: { day: Day; start: string }[],
  vote: Partial<VoteInput>,
) => {
  const dialog = voteDialog(page);
  await expect(dialog).toBeVisible();
  if (vote.name !== undefined) await dialog.getByLabel("Nom").fill(vote.name);
  for (const [index, slot] of slots.entries()) {
    const choice = vote.choices?.[index];
    if (choice)
      await choose(
        page,
        dialog.getByRole("combobox", { name: `Choix – ${slotLabel(slot)}` }),
        choice,
      );
    if (vote.priorities) {
      const priority = dialog.getByRole("checkbox", {
        name: `Prioritaire – ${slotLabel(slot)}`,
      });
      if (await priority.isVisible())
        await priority.setChecked(vote.priorities.includes(index));
    }
  }
  return dialog;
};

export const submitVoteDialog = async (page: Page) => {
  const dialog = voteDialog(page);
  await dialog.getByRole("button", { name: "Confirmer" }).click();
  await expect(dialog).toBeHidden();
};

// a new vote, through the "Nouveau vote" / "Nouvelle inscription" button
export const vote = async (
  page: Page,
  slots: { day: Day; start: string }[],
  input: VoteInput,
) => {
  await page
    .getByRole("button", { name: /^(Nouveau vote|Nouvelle inscription)$/ })
    .click();
  await fillVoteDialog(page, slots, input);
  await submitVoteDialog(page);
};

// REGISTRATION POLLS: the table of the four lists

export const LISTS = {
  registered: "Inscrits",
  waitingList: "Liste d'attente",
  reregistered: "Liste d'attente réinscrits",
  notComing: "Ne viennent pas",
} as const;
export type ListKey = keyof typeof LISTS;

// the (visually hidden) row headers of the rows of names
export const NAMES_ROWS: Record<ListKey, string> = {
  registered: "Personnes inscrites",
  waitingList: "Personnes en liste d'attente",
  reregistered: "Personnes en liste d'attente réinscrits",
  notComing: "Personnes qui ne viennent pas",
};

export type SlotLists = Record<ListKey, string[]> & { count: string };

// Each list is a row of counts, headed by the name of the list ("Inscrits"),
// then a row of names, headed by NAMES_ROWS ("Personnes inscrites"), with one
// cell per slot holding a list of name buttons: the row and column headers
// situate each name for screen readers (e2e/liste-attente.spec.ts checks this
// accessibility tree). The rows are found by their row header, the slots are
// the columns after the column of the row headers.
// Read in one go: several reads could each see another render of the table.
// null while it isn't the table of the lists yet (loading skeleton after a
// reload).
export const readRegistrationTable = async (
  page: Page,
  slotCount: number,
): Promise<SlotLists[] | null> =>
  page
    .getByRole("table")
    .evaluate(
      (table, { slotCount, countsRow, namesRows }) => {
        // the data cells of the row whose header reads `header`
        const cellsOf = (header: string) => {
          const row = [...table.querySelectorAll("tbody > tr")].find(
            (row) =>
              row.querySelector(":scope > th[scope=row]")?.textContent ===
              header,
          );
          return row && [...row.querySelectorAll(":scope > td")];
        };
        const counts = cellsOf(countsRow);
        if (counts?.length !== slotCount) return null;
        const result = counts.map((cell) => ({
          count: cell.textContent!.trim(),
        })) as Record<string, string | string[]>[];
        for (const [key, header] of Object.entries(namesRows)) {
          const cells = cellsOf(header);
          if (cells?.length !== slotCount) return null;
          cells.forEach((cell, slot) => {
            const names = [...cell.querySelectorAll("li")].map((item) =>
              item.textContent!.trim(),
            );
            // the names come with the votes, a moment after the lists
            if (names.includes("")) throw new Error("names not loaded yet");
            result[slot][key] = names;
          });
        }
        return result as SlotLists[];
      },
      { slotCount, countsRow: LISTS.registered, namesRows: NAMES_ROWS },
      // short: expect.poll reads it again until it matches
      { timeout: 2_000 },
    )
    .catch(() => null);

// the lists once the table is there
export const waitForRegistrationTable = async (
  page: Page,
  slotCount: number,
) => {
  let table: SlotLists[] | null = null;
  await expect
    .poll(async () => (table = await readRegistrationTable(page, slotCount)))
    .not.toBeNull();
  return table!;
};

// waits until the lists of the slots are the expected ones (the table is
// refetched after each vote); lists not given are not checked
export const expectRegistrations = async (
  page: Page,
  expected: Partial<Record<ListKey, string[]>>[],
) => {
  await expect
    .poll(async () => {
      const table = await readRegistrationTable(page, expected.length);
      return table?.map((slot, index) =>
        Object.fromEntries(
          Object.keys(expected[index]).map((key) => [
            key,
            slot[key as ListKey],
          ]),
        ),
      );
    })
    .toEqual(expected);
};

// the name button of a vote in the table (registration polls): opens its
// edition dialog, the first one when the vote is in several slots
export const openRegistration = async (page: Page, name: string) => {
  await page
    .getByRole("table")
    .getByRole("button", {
      name: new RegExp(`^${name}( \\(créneau prioritaire\\))?$`),
    })
    .first()
    .click();
  await expect(voteDialog(page)).toHaveAccessibleName(
    "Modifier une inscription",
  );
};

// NOTIFICATIONS: with the push doubles of e2e/support/browser-mocks.ts
export const enableNotifications = async (page: Page) => {
  await page.getByRole("button", { name: "Activer les notifications" }).click();
  const dialog = page.getByRole("alertdialog", {
    name: "Activer les notifications",
  });
  await dialog.getByRole("button", { name: "Confirmer" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Notifications activées" }),
  ).toBeVisible();
  // the bell becomes the state of the notifications of this poll
  await expect(
    page.getByRole("button", { name: "Notifications" }),
  ).toBeVisible();
};

// FREE POLLS: one row per vote, the choices are images named Oui / Non / Ne sais pas

// the table read in one go (several reads could each see another render):
// the text of a cell is read as aloud, its texts and the names of its images
// null while it isn't the table of the votes yet (loading skeleton)
export const readFreePollTable = async (page: Page) =>
  page
    .getByRole("table")
    .evaluate(
      (table) => {
        const read = (cell: Element) => {
          const words: string[] = [];
          const walk = (node: Node) => {
            if (node.nodeType === Node.TEXT_NODE) {
              const text = node.textContent!.trim();
              if (text) words.push(text);
            } else if ((node as Element).getAttribute("role") === "img")
              words.push((node as Element).getAttribute("aria-label")!);
            else node.childNodes.forEach(walk);
          };
          walk(cell);
          return words.join(" ");
        };
        const [total, ...votes] = [...table.querySelectorAll("tbody > tr")];
        if (!total?.querySelector("th")?.textContent?.startsWith("Total"))
          return null;
        // the last cell of each row holds the edit button
        const cells = (row: Element) =>
          [...row.querySelectorAll("td")].slice(0, -1).map(read);
        return {
          // "Total 2 votants"
          total: read(total.querySelector("th")!),
          // "2 Oui" or "0 Oui 1 Ne sais pas" per slot
          totals: cells(total),
          votes: votes.map((row) => ({
            name: read(row.querySelector("th")!),
            choices: cells(row),
          })),
        };
      },
      undefined,
      // short: expect.poll reads it again until it matches
      { timeout: 2_000 },
    )
    .catch(() => null);
