import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// pure unit tests: no database, no network
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", "**/*.integration.test.ts"],
  },
});
