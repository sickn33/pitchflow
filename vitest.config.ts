import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@pitchflow/core": fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url)),
      "@pitchflow/codex": fileURLToPath(new URL("./packages/codex/src/index.ts", import.meta.url)),
      "@pitchflow/export": fileURLToPath(
        new URL("./packages/export/src/index.ts", import.meta.url),
      ),
      "@pitchflow/remotion": fileURLToPath(
        new URL("./packages/remotion/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    coverage: {
      reporter: ["text", "json-summary", "html"],
    },
    environment: "node",
    include: ["packages/**/*.test.ts", "tests/**/*.test.ts"],
  },
});
