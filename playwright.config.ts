import { defineConfig, devices } from "@playwright/test";

import {
  APP_PORT,
  BASE_URL,
  FAKE_CONTROL_PORT,
  FAKE_CONTROL_URL,
  FAKE_HTTPS_PORT,
  TLS_CERT,
  TLS_KEY,
  ensureTlsCertificate,
  getAppServerEnv,
} from "./e2e/support/env";

// End-to-end journeys in a real browser, against `next start` on a LOCAL
// database only (getAppServerEnv throws otherwise). See docs/e2e.md.
const appEnv = getAppServerEnv();
ensureTlsCertificate();

// E2E_SKIP_BUILD=1 reuses the last build (.next) built by this suite
const build = process.env.E2E_SKIP_BUILD ? "" : "pnpm exec next build && ";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/support/global-setup.ts",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // flaky tests must be fixed, not hidden by retries
  retries: 0,
  workers: process.env.E2E_WORKERS ? Number(process.env.E2E_WORKERS) : 4,
  // the journeys with many participants are marked test.slow() (x3)
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [
    ["list"],
    ["html", { open: "never" }],
    ["./e2e/support/a11y-reporter.ts"],
  ],
  use: {
    baseURL: BASE_URL,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `node e2e/support/fake-services.mjs ${FAKE_HTTPS_PORT} ${FAKE_CONTROL_PORT} "${TLS_CERT}" "${TLS_KEY}"`,
      url: `${FAKE_CONTROL_URL}/health`,
      reuseExistingServer: false,
    },
    {
      command: `${build}pnpm exec next start -H 127.0.0.1 -p ${APP_PORT}`,
      url: BASE_URL,
      env: appEnv,
      reuseExistingServer: false,
      timeout: 300_000,
      stdout: "pipe",
    },
  ],
});
