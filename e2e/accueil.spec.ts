import { Page } from "@playwright/test";

import { expect, test } from "./support/fixtures";

// The image of the home page is its largest element (LCP): it is shown by the
// server HTML, without waiting for the JavaScript of its entrance animation.
// The animation stays when the tabs change the image.

// opacity of the shown image of a tab, with the opacity of its ancestors
const shownImageOpacity = (page: Page, alt: string) =>
  page.evaluate((alt) => {
    const image = [
      ...document.querySelectorAll<HTMLImageElement>(`img[alt="${alt}"]`),
    ].find((img) => img.getClientRects().length > 0);
    if (!image) return null;
    let opacity = 1;
    for (let el: Element | null = image; el; el = el.parentElement)
      opacity *= Number(getComputedStyle(el).opacity);
    return opacity;
  }, alt);

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the home image is shown by the server HTML", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("img", { name: "Sondage libre" }),
    ).toBeVisible();
    expect(await shownImageOpacity(page, "Sondage libre")).toBe(1);
  });
});

test("the home image animates when the tab changes", async ({ page }) => {
  await page.goto("/");
  const tab = page.getByRole("tab", { name: "Liste d'attente" });
  // the first render: shown at once, no animation
  expect(await shownImageOpacity(page, "Sondage libre")).toBe(1);

  // the lowest opacity of the image during the 600 ms after a tab change
  const alt = "Sondage avec liste d'attente";
  const sample = async () => {
    await page.evaluate((alt) => {
      const w = window as unknown as { __minOpacity: number };
      w.__minOpacity = 1;
      const end = performance.now() + 600;
      const step = () => {
        const image = [
          ...document.querySelectorAll<HTMLImageElement>(`img[alt="${alt}"]`),
        ].find((img) => img.getClientRects().length > 0);
        let opacity = 1;
        for (let el: Element | null = image ?? null; el; el = el.parentElement)
          opacity *= Number(getComputedStyle(el).opacity);
        if (image) w.__minOpacity = Math.min(w.__minOpacity, opacity);
        if (performance.now() < end) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, alt);
    await tab.click();
    await page.waitForTimeout(700);
    return page.evaluate(
      () => (window as unknown as { __minOpacity: number }).__minOpacity,
    );
  };
  // again until the page is hydrated and the animation features are loaded
  await expect(async () => {
    await page.getByRole("tab", { name: "Libre" }).click();
    expect(await sample()).toBeLessThan(0.5);
  }).toPass();
  await expect.poll(() => shownImageOpacity(page, alt)).toBe(1);
});
