import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    // *.e2e.test.ts are Playwright specs (run via `npm run test:e2e`); they
    // import `@playwright/test`, which is not a vitest runtime -- exclude the
    // glob so the unit runner never tries to collect them.
    exclude: ["**/node_modules/**", ".next", ".worktrees", ".claude/worktrees", "extension", "**/*.e2e.test.ts"],
  },
});
