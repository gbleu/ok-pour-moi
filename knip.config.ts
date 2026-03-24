import type { KnipConfig } from "knip";

export default {
  entry: [
    "src/background/service-worker.ts",
    "src/content/content.ts",
    "src/content/main-world.ts",
    "src/options/options.ts",
    "src/popup/popup.ts",
    "scripts/*.ts",
    "e2e/**/*.ts",
  ],

  ignoreDependencies: ["@types/chrome"],
  ignoreExportsUsedInFile: true,
  rules: {
    exports: "off",
    types: "off",
  },
} satisfies KnipConfig;
