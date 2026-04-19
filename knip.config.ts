import { type KnipConfig } from "knip";

export default {
  entry: [
    "src/background/service-worker.ts",
    "src/content/content.ts",
    "src/content/main-world.ts",
    "src/options/options.ts",
    "src/popup/popup.ts",
    "scripts/*.ts",
    "e2e/tests/**/*.ts",
    "src/**/*.test.ts",
    "vite.config.ts",
  ],

  ignoreDependencies: ["@types/chrome", "@vitest/coverage-v8", "happy-dom"],
  ignoreExportsUsedInFile: true,
  rules: {
    exports: "off",
    types: "off",
  },
} satisfies KnipConfig;
