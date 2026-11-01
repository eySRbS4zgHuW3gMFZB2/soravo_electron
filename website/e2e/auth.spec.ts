import { test, expect, type Route } from "@playwright/test";

const SUPABASE = process.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co";
const ORIGIN = "http://localhost:5174";

const CORS_HEADERS = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
};

async function fulfillJson(route: Route, status: number, body: unknown) {
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

  test("signup confirmation returns to the desktop handoff route", async ({ page }) => {
    let redirectTo = "";
    await page.route(`${SUPABASE}/auth/v1/signup*`, async (route) => {
      redirectTo = new URL(route.request().url()).searchParams.get("redirect_to") ?? "";
      await fulfillJson(route, 200, { id: "u1", email: "a@example.com", confirmation_sent_at: new Date().toISOString() });
    });
    const desktopReturn = "/auth/desktop?state=" + "YQ".repeat(21) + "Y" + "&code_challenge=" + "YQ".repeat(21) + "Y" + "&code_challenge_method=S256";
    await page.goto(`/signup?returnTo=${encodeURIComponent(desktopReturn)}`);
    await page.getByLabel("Email").fill("a@example.com");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page.getByRole("heading", { name: /check your email/i })).toBeVisible();
    expect(redirectTo).toBe("http://localhost:5174/auth/desktop-confirm");
    await expect.poll(() => page.evaluate(() => localStorage.getItem("soravo:pending-auth-return-to"))).toContain(desktopReturn);
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

  test("login password recovery preserves the desktop return route", async ({ page }) => {
    const desktopReturn = "/auth/desktop?state=" + "YQ".repeat(21) + "Y" + "&code_challenge=" + "YQ".repeat(21) + "Y" + "&code_challenge_method=S256";
    await page.goto(`/login?returnTo=${encodeURIComponent(desktopReturn)}`);
    await page.getByRole("link", { name: /forgot password/i }).click();
    await expect(page).toHaveURL(/\/forgot-password\?/);
    expect(new URL(page.url()).searchParams.get("returnTo")).toBe(desktopReturn);
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

  test("desktop password recovery uses a fixed allowlisted URL and stores the safe return route locally", async ({ page }) => {
    let redirectTo = "";
    await page.route(`${SUPABASE}/auth/v1/recover*`, async (route) => {
      redirectTo = new URL(route.request().url()).searchParams.get("redirect_to") ?? "";
      await fulfillJson(route, 200, {});
    });
    const desktopReturn = "/auth/desktop?state=" + "YQ".repeat(21) + "Y" + "&code_challenge=" + "YQ".repeat(21) + "Y" + "&code_challenge_method=S256";
    await page.goto(`/forgot-password?returnTo=${encodeURIComponent(desktopReturn)}`);
    await page.getByLabel("Email").fill("a@example.com");
    await page.getByRole("button", { name: /send reset link/i }).click();
    await expect(page.getByRole("status")).toBeVisible();
    expect(redirectTo).toBe("http://localhost:5174/reset-password");
    await expect.poll(() => page.evaluate(() => localStorage.getItem("soravo:pending-auth-return-to"))).toContain(desktopReturn);
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
