import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm dev --port 3000",
    url: "http://localhost:3000/home",
    reuseExistingServer: true,
    timeout: 180000,
  },
  timeout: 60000,
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
