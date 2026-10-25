import { test, expect } from "@playwright/test";

const routes = [
  ["/", "Voice dictation that stays on your machine."],
  ["/features", "Features"],
  ["/pricing", "Simple pricing"],
  ["/download", "Download"],
  ["/help", "Help"],
  ["/privacy", "Privacy policy"],
  ["/terms", "Terms of service"],
  ["/refunds", "Refunds and cancellation"],
  ["/support", "Support"],
  ["/license", "License policy"],
];

for (const [path, heading] of routes) {
  test(`renders ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  });
}

test("protected account redirects to login", async ({ page }) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
});

test("login form has accessible labels", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
});

test("pricing shows plan content", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.getByText("$12")).toBeVisible();
  await expect(page.getByText("$50")).toBeVisible();
});