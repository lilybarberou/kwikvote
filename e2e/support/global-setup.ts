import { execFileSync } from "node:child_process";

import { getLocalDatabaseUrl } from "./env";

// the schema of the app in the LOCAL database of the suite (getLocalDatabaseUrl
// refuses any other host), explicitly passed: never the one of a .env file
export default function globalSetup() {
  execFileSync("npx", ["prisma", "db", "push", "--skip-generate"], {
    env: { ...process.env, DATABASE_URL: getLocalDatabaseUrl() },
    stdio: "inherit",
  });
}
