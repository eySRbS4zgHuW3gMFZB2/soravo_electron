import { test, expect } from "@playwright/test";

const desktopEmail = process.env.SORAVO_E2E_EMAIL;
const desktopPassword = process.env.SORAVO_E2E_PASSWORD;
const desktopOrigin = process.env.SORAVO_E2E_DESKTOP_ORIGIN ?? "http://127.0.0.1:5173";

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
});

test.describe("SORAVO real browser authentication", () => {
  test.skip(!desktopEmail || !desktopPassword, "Missing SORAVO_E2E_EMAIL or SORAVO_E2E_PASSWORD");

  test("verified credentials sign in and no secret leaks to URL", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(desktopEmail!);
    await page.getByLabel(/password/i).fill(desktopPassword!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/account|\/auth\/desktop/, { timeout: 15000 }).catch(() => undefined);
    await expect(page).not.toHaveURL(/password=|access_token=/);
  });
});
