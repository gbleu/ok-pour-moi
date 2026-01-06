import { defineConfig } from "@playwright/test";

const isCI = Boolean(process.env.CI);

// On CI, use Playwright's bundled Chromium; locally use system Chrome
const CHROME_PATH_MACOS = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// eslint-disable-next-line import/no-default-export
export default defineConfig({
  forbidOnly: isCI,
  fullyParallel: false,
  projects: [
    {
      name: "chromium",
      use: {
        headless: isCI,
        launchOptions: {
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-crash-reporter",
            "--disable-crashpad-for-testing",
            "--disable-gpu-watchdog",
            "--disable-dev-shm-usage",
          ],
          executablePath: isCI ? undefined : CHROME_PATH_MACOS,
        },
      },
    },
  ],
  reporter: [
    ["html", { outputFolder: "../playwright-report" }],
    ["list"],
    ["junit", { outputFile: "../playwright-results.xml" }],
  ],
  retries: isCI ? 2 : 0,
  testDir: "./tests",
  use: {
    trace: "on-first-retry",
    video: "on-first-retry",
  },
  workers: 1,
});
