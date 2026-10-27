import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("https://esm.sh/@supabase/supabase-js@2.49.0", async () => import("@supabase/supabase-js"));

let handler: (request: Request) => Promise<Response>;
let claimStatus: string;
let reserved: boolean;
let saved: Record<string, unknown> | null;
let providerCalls: number;
let claimError: boolean;
let saveError: boolean;
let providerStatus: number;
let providerThrows: boolean;
let planExists: boolean;
let planFails: boolean;
let providerGate: Promise<void>;
let providerEntered: () => void;

async function fakeFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = new URL(String(input));
  const body = init?.body ? JSON.parse(String(init.body)) : null;
  if (url.pathname === "/auth/v1/user") return Response.json({ id: "test-user" });
  if (url.pathname.endsWith("/rpc/claim_monthly_checkout")) {
    if (claimError) return Response.json({ message: "Synthetic database error" }, { status: 500 });
    expect(body.p_user_id).toBe("test-user");
    expect(body.p_request_id).toMatch(/^[0-9a-f-]{36}$/);
    if (saved) return Response.json({ status: "reuse", subscription_id: saved.provider_subscription_id });
    if (claimStatus === "blocked") return Response.json({ status: "blocked", error: "Already active" });
    if (reserved) return Response.json({ status: "busy", error: "Checkout in progress" });
    reserved = true;
    return Response.json({ status: "claimed" });
  }
  if (url.pathname.endsWith("/razorpay_plans")) {
    return Response.json(planExists ? { provider_plan_id: "plan_test" } : null);
  }
  if (url.hostname === "api.razorpay.com" && url.pathname === "/v1/plans") {
    return Response.json(planFails ? {} : { id: "plan_test" }, { status: planFails ? 400 : 200 });
  }
  if (url.hostname === "api.razorpay.com" && url.pathname === "/v1/subscriptions") {
    providerCalls++;
    expect(reserved).toBe(true);
    expect(body).toMatchObject({ plan_id: "plan_test", notes: { user_id: "test-user", plan_code: "monthly" } });
    providerEntered();
    await providerGate;
    if (providerThrows) throw new Error("Synthetic provider timeout");
    return Response.json({ id: "sub_test", status: "created" }, { status: providerStatus });
  }
  if (url.pathname.endsWith("/subscriptions")) {
    if (saveError) return Response.json({ message: "Synthetic save error" }, { status: 500 });
    // A webhook may already have saved a newer status for the provider ID.
    expect(new Headers(init?.headers).get("Prefer")).toContain("resolution=ignore-duplicates");
    saved = body;
    return Response.json(null);
  }
  if (url.pathname.endsWith("/monthly_checkout_reservations")) {
    expect(init?.method).toBe("DELETE");
    expect(url.searchParams.get("user_id")).toBe("eq.test-user");
    expect(url.searchParams.get("request_id")).toMatch(/^eq\.[0-9a-f-]{36}$/);
    reserved = false;
    return Response.json(null);
  }
  throw new Error(`Unexpected request ${url}`);
}

const checkout = () => handler(new Request("https://checkout.invalid", {
  method: "POST", headers: { Authorization: "Bearer synthetic-user-token" },
  body: JSON.stringify({ plan_code: "monthly" }),
}));

beforeAll(async () => {
  const env: Record<string, string> = {
    SUPABASE_URL: "https://supabase.invalid", SUPABASE_ANON_KEY: "synthetic-anon",
    SUPABASE_SERVICE_ROLE_KEY: "synthetic-service", RAZORPAY_KEY_ID: "synthetic-key",
    RAZORPAY_KEY_SECRET: "synthetic-secret",
  };
  vi.stubGlobal("Deno", {
    env: { get: (key: string) => env[key] },
    serve: (callback: typeof handler) => { handler = callback; },
  });
  await import("../functions/create-order/index");
});
beforeEach(() => {
  claimStatus = "claimed";
  reserved = false;
  saved = null;
  providerCalls = 0;
  claimError = saveError = providerThrows = planFails = false;
  planExists = true;
  providerStatus = 200;
  providerGate = Promise.resolve();
  providerEntered = () => {};
  vi.stubGlobal("fetch", vi.fn(fakeFetch));
});
afterAll(() => vi.unstubAllGlobals());

describe("monthly checkout reservation", () => {
  it("returns 409 without calling Razorpay for a blocked account", async () => {
    claimStatus = "blocked";
    expect((await checkout()).status).toBe(409);
    expect(providerCalls).toBe(0);
  });
  it("fails closed when the atomic check fails", async () => {
    claimError = true;
    expect((await checkout()).status).toBe(500);
    expect(providerCalls).toBe(0);
  });
  it("reuses the created provider subscription on subsequent checkout", async () => {
    expect((await checkout()).status).toBe(200);
    expect(await (await checkout()).json()).toMatchObject({ subscription_id: "sub_test" });
    expect(providerCalls).toBe(1);
    expect(reserved).toBe(false);
    expect(saved).not.toHaveProperty("last_event_created_at");
  });
  it("makes only one provider create during concurrent requests", async () => {
    let release!: () => void;
    providerGate = new Promise<void>((resolve) => { release = resolve; });
    const entered = new Promise<void>((resolve) => { providerEntered = resolve; });
    const first = checkout();
    await entered;
    try {
      expect((await checkout()).status).toBe(409);
      expect(providerCalls).toBe(1);
    } finally { release(); }
    expect((await first).status).toBe(200);
  });
  it.each(["timeout", "provider_500", "save_error"])("retains the reservation after %s to prevent an unsafe retry", async (failure) => {
    providerThrows = failure === "timeout";
    providerStatus = failure === "provider_500" ? 500 : 200;
    saveError = failure === "save_error";
    expect((await checkout()).status).toBe(failure === "provider_500" ? 502 : 500);
    expect(reserved).toBe(true);
    expect((await checkout()).status).toBe(409);
    expect(providerCalls).toBe(1);
  });
  it("releases the reservation after a definitive provider rejection", async () => {
    providerStatus = 400;
    expect((await checkout()).status).toBe(502);
    expect(reserved).toBe(false);
    providerStatus = 200;
    expect((await checkout()).status).toBe(200);
  });
  it("releases a reservation if plan creation fails before subscription creation", async () => {
    planExists = false;
    planFails = true;
    expect((await checkout()).status).toBe(502);
    expect(reserved).toBe(false);
    expect(providerCalls).toBe(0);
  });
});
