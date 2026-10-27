import { test, expect } from "@playwright/test";

const routes = [
  "/",
  "/features",
  "/pricing",
  "/download",
  "/help",
  "/privacy",
  "/terms",
  "/refunds",
  "/support",
  "/license",
  "/login",
  "/signup",
];

for (const path of routes) {
  test(`deep link renders and survives reload: ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(path);
    await expect(page.locator("#root")).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(path);
    await expect(page.locator("#root")).toBeVisible();
  });
}

test("unknown route fails safely", async ({ page }) => {
  await page.goto("/this-route-does-not-exist");
  await expect(page).toHaveURL("/");
});

test("download page does not expose an unverified installer URL", async ({ page }) => {
  await page.goto("/download");
  const soravoReleaseLinks = page.locator('a[href*="soravo-releases"]');
  await expect(soravoReleaseLinks).toHaveCount(0);
  await expect(page.getByText(/not.*published|not.*available/i).first()).toBeVisible();
});
