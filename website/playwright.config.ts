import { defineConfig, devices } from "@playwright/test";
import { loadEnv } from "vite";

// Read the same local values Vite uses so the E2E server and the test request
// interceptors agree on the Supabase origin. Keep non-VITE credentials in the
// Playwright process only; Vite never exposes them to the browser bundle.
const localEnv = loadEnv("development", process.cwd(), "");
for (const key of [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "SORAVO_E2E_EMAIL",
  "SORAVO_E2E_PASSWORD",
]) {
  if (!process.env[key] && localEnv[key]) process.env[key] = localEnv[key];
}

const viteTestEnv = {
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co",
  VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || "placeholder-anon-key",
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5174",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "npm run dev",
      url: "http://localhost:5174",
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: viteTestEnv,
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
