import { test, expect } from "@playwright/test";

const SUPABASE = "https://placeholder.supabase.co";
const ORIGIN = "http://localhost:5173";

const CORS_HEADERS = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
};

async function fulfillJson(route: any, status: number, body: unknown) {
  if (route.request().method() === "OPTIONS") {
    await route.fulfill({ status: 204, headers: CORS_HEADERS });
    return;
  }
  await route.fulfill({
    status,
    headers: { ...CORS_HEADERS, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test.describe("auth flows (mocked Supabase)", () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`${SUPABASE}/auth/v1/user*`, async (route) => {
      await fulfillJson(route, 401, { error: "no session" });
    });
    await page.route(`${SUPABASE}/rest/v1/**`, async (route) => {
      await fulfillJson(route, 200, []);
    });
  });

  test("signup shows confirmation message on success", async ({ page }) => {
    await page.route(`${SUPABASE}/auth/v1/signup*`, async (route) => {
      await fulfillJson(route, 200, {
        id: "u1",
        email: "a@example.com",
        confirmation_sent_at: new Date().toISOString(),
      });
    });
    await page.goto("/signup");
    await page.getByLabel("Email").fill("a@example.com");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page.getByRole("heading", { name: /check your email/i })).toBeVisible();
  });

  test("signup surfaces duplicate-email errors", async ({ page }) => {
    await page.route(`${SUPABASE}/auth/v1/signup*`, async (route) => {
      await fulfillJson(route, 400, { error: "User already registered", error_code: "user_already_exists" });
    });
    await page.goto("/signup");
    await page.getByLabel("Email").fill("a@example.com");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page.getByText(/already registered/i)).toBeVisible();
  });

  test("login failure shows an error", async ({ page }) => {
    await page.route(`${SUPABASE}/auth/v1/token*`, async (route) => {
      await fulfillJson(route, 400, { error: "invalid_grant", error_description: "Invalid login credentials" });
    });
    await page.goto("/login");
    await page.getByLabel("Email").fill("a@example.com");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: /log in/i }).click();
    await expect(page.getByText(/invalid login credentials/i)).toBeVisible();
  });

  test("forgot password shows success message", async ({ page }) => {
    await page.route(`${SUPABASE}/auth/v1/recover*`, async (route) => {
      await fulfillJson(route, 200, {});
    });
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