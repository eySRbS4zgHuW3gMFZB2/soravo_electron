import { test, expect } from "@playwright/test";

// Critical routes that must be deep-linkable and survive a reload.
const deepLinks = [
  "/pricing",
  "/download",
  "/account",
  "/login?returnTo=%2Faccount",
  "/reset-password",
];

for (const path of deepLinks) {
  test(`direct navigation and reload work for ${path}`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBeLessThan(400);
    await expect(page).not.toHaveURL(/404/);
    const reloaded = await page.reload();
    expect(reloaded?.status()).toBeLessThan(400);
    await expect(page).not.toHaveURL(/404/);
  });
}

test("SPA fallback is served for an unknown route", async ({ page }) => {
  await page.goto("/this/path/does/not/exist");
  // Unknown routes currently redirect to `/`; ensure the app shell loads.
  await expect(page.getByRole("heading", { name: /Voice dictation/i })).toBeVisible();
});

test("protected account route redirects unauthenticated users to login", async ({ page }) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login/);
  await page.reload();
  await expect(page).toHaveURL(/\/login/);
});
