import { Page } from "@playwright/test";

import { checkA11y } from "./support/a11y";
import { expect, test } from "./support/fixtures";

// The chosen poll type card of the creation form must be told apart from the
// other one at a glance, in both themes: a border of the primary color, with
// a contrast of at least 3:1 (WCAG 1.4.11, non-text contrast).

type Rgba = [number, number, number, number];

const parseColor = (color: string): Rgba => {
  const [r, g, b, a = 1] = color.match(/[\d.]+/g)!.map(Number);
  return [r, g, b, a];
};

// a color drawn over an opaque one
const over = ([r, g, b, a]: Rgba, [R, G, B]: Rgba): Rgba => [
  r * a + R * (1 - a),
  g * a + G * (1 - a),
  b * a + B * (1 - a),
  1,
];

const luminance = ([r, g, b]: Rgba) => {
  const [R, G, B] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
};

const contrast = (a: Rgba, b: Rgba) => {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

const cardStyles = (page: Page) =>
  page.evaluate(() => {
    const style = (id: string) => {
      const s = getComputedStyle(document.querySelector(`label[for=${id}]`)!);
      return {
        border: s.borderTopColor,
        outline: s.outlineStyle === "none" ? null : s.outlineColor,
        background: s.backgroundColor,
        ring: s.boxShadow,
      };
    };
    return {
      page: getComputedStyle(document.body).backgroundColor,
      free: style("type-1"),
      registration: style("type-2"),
    };
  });

for (const theme of ["light", "dark"] as const) {
  test(`the chosen poll type card stands out (${theme} theme)`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/poll/creer");
    const free = page.getByRole("radio", { name: "Sondage libre" });
    await expect(free).toBeChecked();

    const expectChosen = async (chosen: "free" | "registration") => {
      const other = chosen === "free" ? "registration" : "free";
      const styles = await cardStyles(page);
      const pageColor = parseColor(styles.page);
      const border = parseColor(styles[chosen].border);
      // the chosen card has a primary border, doubled by an outline...
      expect(styles[chosen].outline).toBe(styles[chosen].border);
      expect(styles[chosen].border).not.toBe(styles[other].border);
      expect(styles[other].outline).toBeNull();
      // ...which stands out from the page and from the inside of the card
      const inside = over(parseColor(styles[chosen].background), pageColor);
      expect(contrast(border, pageColor)).toBeGreaterThanOrEqual(3);
      expect(contrast(border, inside)).toBeGreaterThanOrEqual(3);
    };
    await expectChosen("free");

    // with the keyboard: the focus is visible and the choice follows (again
    // until the page is hydrated: the server HTML ignores the arrows)
    await expect(async () => {
      await free.focus();
      await page.keyboard.press("ArrowRight");
      await expect(
        page.getByRole("radio", { name: "Sondage avec liste d'attente" }),
      ).toBeChecked({ timeout: 1_000 });
    }).toPass();
    await expectChosen("registration");
    expect((await cardStyles(page)).registration.ring).not.toBe("none");
    await checkA11y(page, `creation type cards (${theme})`);

    // with the mouse
    await page.getByText("Sondage libre", { exact: true }).click();
    await expect(free).toBeChecked();
    await expectChosen("free");
  });
}
