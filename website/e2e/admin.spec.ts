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

test("admin read-only navigation works with a mocked backend", async ({ page }) => {
  const SUPABASE = "https://placeholder.supabase.co";
  const ORIGIN = "http://localhost:5173";
  const CORS_HEADERS = {
    "access-control-allow-origin": ORIGIN,
    "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, x-admin-token",
  };
  function fulfillJson(route: any, status: number, body: unknown) {
    if (route.request().method() === "OPTIONS") {
      route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }
    route.fulfill({ status, headers: { ...CORS_HEADERS, "content-type": "application/json" }, body: JSON.stringify(body) });
  }
  await page.route(`${SUPABASE}/auth/v1/token*`, async (route) => {
    await fulfillJson(route, 200, { access_token: "admin-token", refresh_token: "refresh", token_type: "bearer", expires_in: 3600, user: { id: "admin-1", email: "admin@example.com" } });
  });
  await page.route(`${SUPABASE}/auth/v1/user*`, async (route) => {
    await fulfillJson(route, 200, { id: "admin-1", email: "admin@example.com" });
  });
  await page.route(`${SUPABASE}/functions/v1/admin-dashboard`, async (route) => {
    const body = JSON.parse(route.request().postData() || "{}");
    if (route.request().method() === "OPTIONS") { await route.fulfill({ status: 204, headers: CORS_HEADERS }); return; }
    if (body.action === "overview") {
      await fulfillJson(route, 200, {
        totalUsers: 2, newUsers30d: 1, activeUsers: 1, activeDevices: 1, totalDevices: 1,
        lifetimeEntitlements: 1, monthlyEntitlements: 1, paymentTotalMinor: 1200, capturedPayments: 1,
        failedPayments: 0, refundedPayments: 0, totalPayments: 1, lifetimePaymentCount: 0,
        recurringPaymentCount: 1, lifetimePaymentTotalMinor: 0, recurringPaymentTotalMinor: 1200,
        subscriptionBreakdown: { active: 1 }, webhookBreakdown: { processed: 1 }, newUsersByDay: [],
      });
    } else if (body.action === "users") {
      await fulfillJson(route, 200, { users: [{ userId: "u-1", email: "user@example.com", signupDate: "2026-01-01T00:00:00.000Z", entitlements: [], payments: { total: 0 }, devices: { active: 0, total: 0 } }], page: 1, pageSize: 25, total: 1 });
    } else if (body.action === "payments") {
      await fulfillJson(route, 200, { payments: [{ id: "p-1", user_id: "u-1", userEmail: "user@example.com", amount_minor: 1200, currency: "USD", status: "captured", created_at: "2026-01-01T00:00:00.000Z" }], page: 1, pageSize: 25, total: 1 });
    } else if (body.action === "subscriptions") {
      await fulfillJson(route, 200, { subscriptions: [{ id: "s-1", user_id: "u-1", userEmail: "user@example.com", status: "active", current_period_end: "2026-02-01T00:00:00.000Z" }] });
    } else if (body.action === "devices") {
      await fulfillJson(route, 200, { devices: [{ id: "d-1", user_id: "u-1", userEmail: "user@example.com", label: "Device 1", platform: "windows", last_seen_at: "2026-01-01T00:00:00.000Z", revoked_at: null }] });
    } else if (body.action === "audit") {
      await fulfillJson(route, 200, { events: [{ id: "a-1", actor_user_id: "admin-1", actorEmail: "admin@example.com", action: "admin.overview.read", target_type: "admin_dashboard", target_id: "dashboard", created_at: "2026-01-01T00:00:00.000Z" }], page: 1, pageSize: 25, total: 1 });
    }
  });

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Email").fill("admin@example.com");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/admin$/);

  await expect(page.getByRole("heading", { name: "Administrator dashboard" })).toBeVisible();
  await expect(page.getByText("Registered users")).toBeVisible();

  const clickSection = async (name: RegExp, expected: string) => {
    const button = page.getByRole("button", { name }).first();
    await button.click();
    await expect(page.getByText(expected)).toBeVisible();
  };

  await clickSection(/^users$/i, "person@example.com".replace("person", "user"));
  await clickSection(/^payments$/i, "1200");
  await clickSection(/^subscriptions$/i, "active");
  await clickSection(/^devices$/i, "Device 1");
  await clickSection(/^audit$/i, "admin.overview.read");
});