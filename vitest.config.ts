import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      reporter: ["text", "json-summary", "html"],
    },
    environment: "node",
    include: ["packages/**/*.test.ts", "tests/**/*.test.ts"],
  },
});
