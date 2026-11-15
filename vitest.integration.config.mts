import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// server actions against a database: run with a LOCAL DATABASE_URL only
// (test/integration-setup.ts refuses any other host)
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // only throws outside of the react server bundle
      "server-only": fileURLToPath(
        new URL("./test/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    name: "integration",
    include: ["**/*.integration.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    setupFiles: ["./test/integration-setup.ts"],
    fileParallelism: false,
  },
});
