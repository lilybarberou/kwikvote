import { defineConfig } from "vitest/config";

// coverage of the unit and the integration tests together:
// run with a LOCAL DATABASE_URL only (test/integration-setup.ts refuses any other host)
export default defineConfig({
  test: {
    projects: ["./vitest.config.mts", "./vitest.integration.config.mts"],
    // the integration tests share the database
    fileParallelism: false,
    coverage: {
      provider: "v8",
      // server and business logic, the React components are not covered
      include: ["lib/**/*.ts", "prisma/db.ts", "cron.js"],
      exclude: ["**/*.test.ts", "lib/fonts.ts"],
      reporter: ["text", "json-summary", "html"],
      reportsDirectory: "coverage",
    },
  },
});
