import { test, expect } from "@playwright/test";

const desktopEmail = process.env.SORAVO_E2E_EMAIL;
const desktopPassword = process.env.SORAVO_E2E_PASSWORD;
const SUPABASE = process.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co";
const ORIGIN = "http://localhost:5174";
const SUPABASE_STORAGE_KEY = `sb-${new URL(SUPABASE).hostname.split(".")[0]}-auth-token`;

async function fulfillJson(route: import("@playwright/test").Route, status: number, body: unknown) {
  if (route.request().method() === "OPTIONS") {
    await route.fulfill({ status: 204, headers: {
      "access-control-allow-origin": ORIGIN,
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
    } });
    return;
  }
  await route.fulfill({ status, headers: {
    "access-control-allow-origin": ORIGIN,
    "content-type": "application/json",
  }, body: JSON.stringify(body) });
}

test.describe("SORAVO desktop auth route (web side)", () => {
  test("rejects missing desktop auth parameters", async ({ page }) => {
    await page.goto("/auth/desktop");
    await expect(page.getByText("Missing or invalid desktop authentication parameters.")).toBeVisible();
  });

  test("keeps callback destination limited to the desktop scheme", async ({ page }) => {
    await page.goto("/auth/desktop?state=test-state&code_challenge=test-challenge&code_challenge_method=S256");
    await expect(page.getByRole("link", { name: /sign in/i })).toBeVisible();
    await expect(page).not.toHaveURL(/soravo\.xyz/);
  });

  test("does not render credentials or tokens", async ({ page }) => {
    await page.goto("/auth/desktop?state=test-state&code_challenge=test-challenge&code_challenge_method=S256");
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });

  test("fixed email confirmation URL restores the desktop auth request from local storage", async ({ page }) => {
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    const desktopReturn = "/auth/desktop?state=" + "YQ".repeat(21) + "Y" + "&code_challenge=" + "YQ".repeat(21) + "Y" + "&code_challenge_method=S256";
    await page.addInitScript(({ key, expiration, returnTo }) => {
      localStorage.setItem(key, JSON.stringify({
        access_token: "mock-browser-access-token",
        refresh_token: "mock-browser-refresh-token",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: expiration,
        user: {
          id: "desktop-auth-user",
          aud: "authenticated",
          role: "authenticated",
          email: "desktop-auth@example.com",
          app_metadata: { provider: "email", providers: ["email"] },
          user_metadata: {},
          created_at: new Date().toISOString(),
        },
      }));
      localStorage.setItem("soravo:pending-auth-return-to", JSON.stringify({ returnTo, createdAt: Date.now() }));
    }, { key: SUPABASE_STORAGE_KEY, expiration: expiresAt, returnTo: desktopReturn });
    await page.route(`${SUPABASE}/auth/v1/user*`, async (route) => {
      await fulfillJson(route, 200, {
        id: "desktop-auth-user",
        aud: "authenticated",
        role: "authenticated",
        email: "desktop-auth@example.com",
        app_metadata: { provider: "email", providers: ["email"] },
        user_metadata: {},
        created_at: new Date().toISOString(),
      });
    });

    await page.goto("/auth/desktop-confirm");
    await expect(page).toHaveURL(/\/auth\/desktop\?/);
    await expect(page.getByRole("button", { name: "Continue to Soravo" })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("soravo:pending-auth-return-to"))).toBeNull();
  });

  test("authenticated browser session requires confirmation and can retry a failed handoff", async ({ page }) => {
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    await page.addInitScript(({ key, expiration }) => {
      localStorage.setItem(key, JSON.stringify({
        access_token: "mock-browser-access-token",
        refresh_token: "mock-browser-refresh-token",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: expiration,
        user: {
          id: "desktop-auth-user",
          aud: "authenticated",
          role: "authenticated",
          email: "desktop-auth@example.com",
          app_metadata: { provider: "email", providers: ["email"] },
          user_metadata: {},
          created_at: new Date().toISOString(),
        },
      }));
    }, { key: SUPABASE_STORAGE_KEY, expiration: expiresAt });

    await page.route(`${SUPABASE}/auth/v1/user*`, async (route) => {
      await fulfillJson(route, 200, {
        id: "desktop-auth-user",
        aud: "authenticated",
        role: "authenticated",
        email: "desktop-auth@example.com",
        app_metadata: { provider: "email", providers: ["email"] },
        user_metadata: {},
        created_at: new Date().toISOString(),
      });
    });
    let issueRequests = 0;
    await page.route(`${SUPABASE}/functions/v1/desktop-auth-handoff`, async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: {
          "access-control-allow-origin": ORIGIN,
          "access-control-allow-methods": "POST, OPTIONS",
          "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
        } });
        return;
      }
      issueRequests += 1;
      const body = route.request().postDataJSON();
      expect(body).toMatchObject({ action: "issue", code_challenge_method: "S256" });
      if (issueRequests === 1) {
        await route.fulfill({ status: 503, headers: { "access-control-allow-origin": ORIGIN, "content-type": "application/json" }, body: JSON.stringify({ error: "temporarily unavailable" }) });
        return;
      }
      await route.fulfill({
        status: 200,
        headers: { "access-control-allow-origin": ORIGIN, "content-type": "application/json" },
        body: JSON.stringify({ code: "A".repeat(32), state: body.state, expires_at: new Date(Date.now() + 120_000).toISOString() }),
      });
    });

    await page.goto("/auth/desktop?state=YQYQYQYQYQYQYQYQYQYQYQYQYQYQYQYQYQYQYQYQYQY&code_challenge=YQYQYQYQYQYQYQYQYQYQYQYQYQYQYQYQYQYQYQYQYQY&code_challenge_method=S256");
    await expect(page.getByText(/signed in as desktop-auth@example\.com/i)).toBeVisible();
    await expect(page.getByText(/never share the open soravo link/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue to Soravo" })).toBeVisible();
    expect(issueRequests).toBe(0);
    await page.getByRole("button", { name: "Continue to Soravo" }).click();
    await expect(page.getByRole("alert")).toContainText(/try again/i);
    await expect(page.getByRole("button", { name: "Continue to Soravo" })).toBeEnabled();
    await page.getByRole("button", { name: "Continue to Soravo" }).click();
    await expect(page.getByRole("link", { name: "Open Soravo" })).toBeVisible();
    expect(issueRequests).toBe(2);
    await expect(page.getByRole("link", { name: "Open Soravo" })).toHaveAttribute("href", /^soravo:\/\/auth\/callback\?/);
    await expect(page.getByText(/select open soravo/i)).toBeVisible();
  });
});

test.describe("SORAVO real browser authentication", () => {
  test.skip(!desktopEmail || !desktopPassword, "Missing SORAVO_E2E_EMAIL or SORAVO_E2E_PASSWORD");

  test("verified credentials sign in and no secret leaks to URL", async ({ page }) => {
    const desktopReturn = "/auth/desktop?state=" + "YQ".repeat(21) + "Y" + "&code_challenge=" + "YQ".repeat(21) + "Y" + "&code_challenge_method=S256";
    let issueRequests = 0;
    await page.route(`${SUPABASE}/functions/v1/desktop-auth-handoff`, async (route) => {
      issueRequests += 1;
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "unexpected automatic handoff" }) });
    });
    await page.goto(`/login?returnTo=${encodeURIComponent(desktopReturn)}`);
    await page.getByLabel(/email/i).fill(desktopEmail!);
    await page.getByLabel(/password/i).fill(desktopPassword!);
    await page.getByRole("button", { name: /log in/i }).click();
    await expect(page).toHaveURL(/\/auth\/desktop\?/, { timeout: 30000 });
    await expect(page.getByRole("button", { name: "Continue to Soravo" })).toBeVisible();
    await expect(page).not.toHaveURL(/password=|access_token=|token_hash=/);
    expect(issueRequests).toBe(0);
  });
});
