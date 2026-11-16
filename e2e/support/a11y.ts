import AxeBuilder from "@axe-core/playwright";
import { Page, test } from "@playwright/test";

// Automatic accessibility checks of the pages the journeys go through, in
// warning mode: a violation never fails a test, it is reported as an
// annotation ("a11y") on the test, attached as JSON, and summed up at the end
// of the run by e2e/support/a11y-reporter.ts.
export const checkA11y = async (
  page: Page,
  label: string,
  options: { keepMouse?: boolean } = {},
) => {
  // a stable page: the last clicked element is not hovered (unless asked)
  // and the opening animations are over, axe would see their half opacity
  if (!options.keepMouse) await page.mouse.move(0, 0);
  await page
    .waitForFunction(
      () =>
        document
          .getAnimations()
          .every((animation) => animation.playState !== "running"),
      undefined,
      { timeout: 3_000 },
    )
    .catch(() => {});
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  if (!results.violations.length) return;

  const summary = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes.map((node) => node.target.join(" ")),
  }));
  // "rule (impact, nodes); rule (impact, nodes)"
  const description = summary
    .map(({ id, impact, nodes }) => `${id} (${impact}, ${nodes.length})`)
    .join("; ");
  test.info().annotations.push({
    type: "a11y",
    description: `${label}: ${description}`,
  });
  if (process.env.E2E_A11Y_VERBOSE)
    console.warn(`[a11y] ${label}`, JSON.stringify(summary, null, 2));
  await test.info().attach(`a11y-${label}`, {
    body: JSON.stringify(summary, null, 2),
    contentType: "application/json",
  });
};
