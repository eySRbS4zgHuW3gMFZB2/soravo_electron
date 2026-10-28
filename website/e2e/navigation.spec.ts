import { test, expect } from "@playwright/test";

// Runs against both Vite and the built site served by Wrangler Pages.
// Critical routes that must be deep-linkable and survive a reload.
const deepLinks = [
  ["/pricing", "Simple pricing"],
  ["/download", "Download"],
  ["/account", "Log in"],
  ["/login?returnTo=%2Faccount", "Log in"],
  ["/reset-password", "Choose a new password"],
];

for (const [path, heading] of deepLinks) {
  test(`direct navigation and reload work for ${path}`, async ({ page, request }) => {
    // Check the server response independently of the browser's client routing.
    const document = await request.get(path);
    expect(document.status()).toBe(200);
    expect(document.headers()["content-type"]).toContain("text/html");
    expect(await document.text()).toContain('<div id="root">');
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page).not.toHaveURL(/404/);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    const reloaded = await page.reload();
    expect(reloaded?.status()).toBe(200);
    await expect(page).not.toHaveURL(/404/);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  });
}

test("SPA fallback is served for an unknown route", async ({ page, request }) => {
  const path = "/this/path/does/not/exist";
  const document = await request.get(path);
  expect(document.status()).toBe(200);
  expect(await document.text()).toContain('<div id="root">');
  const response = await page.goto(path);
  expect(response?.status()).toBe(200);
  // Unknown routes currently redirect to `/`; ensure the app shell loads.
  await expect(page.getByRole("heading", { name: /Voice dictation/i })).toBeVisible();
});

test("built assets are served without the HTML fallback", async ({ page, request }) => {
  await page.goto("/");
  const script = await page.locator('script[type="module"][src]').last().getAttribute("src");
  expect(script).toBeTruthy();
  const asset = await request.get(script!);
  expect(asset.status()).toBe(200);
  expect(asset.headers()["content-type"]).toMatch(/javascript/);
  expect(await asset.text()).not.toContain('<div id="root">');
});

test("protected account route redirects unauthenticated users to login", async ({ page }) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login/);
  await page.reload();
  await expect(page).toHaveURL(/\/login/);
});
