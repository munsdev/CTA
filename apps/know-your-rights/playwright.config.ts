import { defineConfig, devices } from "@playwright/test";

/* Set PW_CHROMIUM to use a preinstalled Chromium instead of `npx playwright install`. */
const executablePath = process.env.PW_CHROMIUM || undefined;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:8766",
    reducedMotion: "reduce",
    launchOptions: { executablePath },
  },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 860 } } },
  ],
  webServer: { command: "npm run preview", port: 8766, reuseExistingServer: !process.env.CI },
});
