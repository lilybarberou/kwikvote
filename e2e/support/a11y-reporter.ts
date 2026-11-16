import type {
  FullResult,
  Reporter,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";

// Sums up the "a11y" annotations of e2e/support/a11y.ts at the end of the run
export default class A11yReporter implements Reporter {
  private warnings = new Map<string, Set<string>>();

  onTestEnd(test: TestCase, result: TestResult) {
    for (const annotation of result.annotations) {
      if (annotation.type !== "a11y" || !annotation.description) continue;
      const separator = annotation.description.lastIndexOf(": ");
      const label = annotation.description.slice(0, separator);
      const rules = annotation.description.slice(separator + 2);
      for (const rule of rules.split("; ")) {
        const id = rule.split(" ")[0];
        if (!this.warnings.has(id)) this.warnings.set(id, new Set());
        this.warnings.get(id)!.add(label);
      }
    }
  }

  onEnd(_result: FullResult) {
    if (!this.warnings.size) {
      console.log("\naxe: no accessibility violation on the visited pages");
      return;
    }
    console.log("\naxe warnings (they do not fail the tests):");
    for (const [id, labels] of this.warnings)
      console.log(`  - ${id}: ${[...labels].sort().join(", ")}`);
  }
}
