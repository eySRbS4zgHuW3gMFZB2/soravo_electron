import { test, expect, type Route } from "@playwright/test";

const SUPABASE = "https://placeholder.supabase.co";
const CORS_HEADERS = {
  "access-control-allow-origin": "http://localhost:5173",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
};

function mockSupabase(response: Parameters<Route["fulfill"]>[0]) {
  return async (route: Route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    await route.fulfill({ ...response, headers: CORS_HEADERS });
  };
}

test.describe("auth flows (mocked Supabase)", () => {
  test.beforeEach(async ({ page }) => {
    // Default: not configured-ish backend returns success for session restore.
    await page.route(`${SUPABASE}/auth/v1/user*`, mockSupabase({ status: 401, body: JSON.stringify({ error: "no session" }) }));
    await page.route(`${SUPABASE}/rest/v1/**`, mockSupabase({ status: 200, contentType: "application/json", body: "[]" }));
  });

  test("signup shows confirmation message on success", async ({ page }) => {
    await page.route(`${SUPABASE}/auth/v1/signup*`, mockSupabase({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: "u1", email: "a@example.com", confirmation_sent_at: new Date().toISOString() }),
    }));
    await page.goto("/signup");
    await page.getByLabel("Email").fill("a@example.com");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page.getByRole("heading", { name: /check your email/i })).toBeVisible();
  });

  test("signup surfaces duplicate-email errors", async ({ page }) => {
    await page.route(`${SUPABASE}/auth/v1/signup*`, mockSupabase({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ error: "User already registered", error_code: "user_already_exists" }),
    }));
    await page.goto("/signup");
    await page.getByLabel("Email").fill("a@example.com");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page.getByText(/already registered/i)).toBeVisible();
  });

  test("login failure shows an error", async ({ page }) => {
    await page.route(`${SUPABASE}/auth/v1/token*`, mockSupabase({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ error: "invalid_grant", error_description: "Invalid login credentials" }),
    }));
    await page.goto("/login");
    await page.getByLabel("Email").fill("a@example.com");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: /log in/i }).click();
    await expect(page.getByText(/invalid login credentials/i)).toBeVisible();
  });

  test("forgot password shows success message", async ({ page }) => {
    await page.route(`${SUPABASE}/auth/v1/recover*`, mockSupabase({ status: 200, contentType: "application/json", body: "{}" }));
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill("a@example.com");
    await page.getByRole("button", { name: /send reset link/i }).click();
    await expect(page.getByRole("status")).toBeVisible();
  });

  test("reset password page reports invalid link without a session", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(page.getByText(/invalid or has expired/i)).toBeVisible();
  });

  test("protected account redirects signed-out users to login", async ({ page }) => {
    await page.goto("/account");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
  });

  test("login form is usable on a mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/login");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: /log in/i })).toBeVisible();
  });
});
