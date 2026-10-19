import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  timeout: 30000,
  expect: { timeout: 7000 },
  globalSetup: fileURLToPath(
    new URL("./support/build-client.ts", import.meta.url),
  ),
  outputDir: "./test-results",
  reporter: [
    ["list"],
    ["./support/endpoint-reporter.ts"],
    ["html", { outputFolder: "reports/html", open: "never" }],
    ["junit", { outputFile: "reports/junit.xml" }],
    ["json", { outputFile: "reports/results.json" }],
  ],
  use: {
    headless: false,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10000,
  },
  projects: [
    { name: "api", testMatch: /(?:api|db)\/.*\.spec\.ts$/ },
    {
      name: "chromium",
      testMatch: /ui\/.*\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      testMatch: /ui\/.*\.spec\.ts$/,
      use: { ...devices["Pixel 7"] },
    },
  ],
});
