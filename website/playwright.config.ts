import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "npm run dev",
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command: "npm run build && npm run preview:pages",
      url: "http://127.0.0.1:8788",
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "pages-chromium",
      testMatch: "navigation.spec.ts",
      use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:8788" },
    },
  ],
});
