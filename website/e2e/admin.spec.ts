import { test, expect } from "@playwright/test";

test("admin route redirects unauthenticated users to login", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);
  await page.reload();
  await expect(page).toHaveURL(/\/login/);
});

test("admin deep link is served by SPA fallback", async ({ page, request }) => {
  const document = await request.get("/admin");
  expect(document.status()).toBe(200);
  const response = await page.goto("/admin");
  expect(response?.status()).toBe(200);
  await expect(page).not.toHaveURL(/404/);
});