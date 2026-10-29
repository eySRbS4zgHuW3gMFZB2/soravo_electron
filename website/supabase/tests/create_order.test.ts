import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("https://esm.sh/@supabase/supabase-js@2.49.0", async () => import("@supabase/supabase-js"));

let handler: (request: Request) => Promise<Response>;
let claimStatus: string;
let reserved: boolean;
let saved: Record<string, unknown> | null;
let providerCalls: number;
let cancelCalls: number;
let cancelStatus: number;
let cancelThrows: boolean;
let cancelStalls: boolean;
let cancelSignal: AbortSignal | null | undefined;
let cancelEntered: () => void;
let cancelRequest: { method: string | undefined; authorization: string | null; body: unknown } | null;
let claimError: string | null;
let openStatus: string | null;
let raceStatus: string | null;
let raceLookupError: boolean;
let raceReads: number;
const blockingStatuses = ["authenticated", "active", "pending", "resumed"];
let saveError: boolean;
let providerStatus: number;
let providerThrows: boolean;
let planExists: boolean;
let planFails: boolean;
let planLookupFails: boolean;
let planInsertError: string | null;
let planReads: number;
let planProviderCalls: number;
let requestId: string;
let providerGate: Promise<void>;
let providerEntered: () => void;
let lifetimeReserved: boolean;
let lifetimeSaved: Record<string, unknown> | null;
let orderCalls: number;
let orderMalformed: boolean;
let claimCalls: number;
let authenticated: boolean;

async function fakeFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = new URL(String(input));
  const body = init?.body ? JSON.parse(String(init.body)) : null;
  if (url.pathname === "/auth/v1/user") {
    return authenticated ? Response.json({ id: "test-user" })
      : Response.json({ message: "Invalid token" }, { status: 401 });
  }
  if (url.pathname.endsWith("/rpc/claim_lifetime_checkout")) {
    claimCalls++;
    expect(body.p_user_id).toBe("test-user");
    expect(body.p_request_id).toMatch(/^[0-9a-f-]{36}$/);
    requestId = body.p_request_id;
    if (claimError) return Response.json({ message: "Synthetic database error" }, { status: 500 });
    if (claimStatus === "blocked") return Response.json({ status: "blocked", error: "Lifetime already active" });
    if (lifetimeSaved) return Response.json({ status: "reuse", order_id: lifetimeSaved.provider_order_id });
    if (lifetimeReserved) return Response.json({ status: "busy", error: "Checkout in progress" });
    lifetimeReserved = true;
    return Response.json({ status: "claimed" });
  }
  if (url.hostname === "api.razorpay.com" && url.pathname === "/v1/orders") {
    orderCalls++;
    expect(lifetimeReserved).toBe(true);
    expect(body).toMatchObject({ amount: 5000, currency: "USD", notes: {
      user_id: "test-user", plan_code: "lifetime", checkout_request_id: requestId,
    } });
    providerEntered();
    await providerGate;
    if (providerThrows) throw new Error("Synthetic provider timeout");
    return Response.json(providerStatus >= 400 ? { error: { code: "SYNTHETIC_PROVIDER_ERROR" } }
      : orderMalformed ? {} : { id: "order_test", amount: 5000, currency: "USD" }, { status: providerStatus });
  }
  if (url.pathname.endsWith("/payments")) {
    expect(init?.method).toBe("POST");
    if (saveError) return Response.json({ message: "Synthetic save error" }, { status: 500 });
    lifetimeSaved = body;
    return Response.json(null, { status: 201 });
  }
  if (url.pathname.endsWith("/lifetime_checkout_reservations")) {
    expect(init?.method).toBe("DELETE");
    expect(url.searchParams.get("user_id")).toBe("eq.test-user");
    expect(url.searchParams.get("request_id")).toMatch(/^eq\.[0-9a-f-]{36}$/);
    lifetimeReserved = false;
    return Response.json(null);
  }
  if (url.pathname.endsWith("/rpc/claim_monthly_checkout")) {
    if (claimError) return Response.json({ message: "Synthetic database error" }, { status: 500 });
    expect(body.p_user_id).toBe("test-user");
    expect(body.p_request_id).toMatch(/^[0-9a-f-]{36}$/);
    requestId = body.p_request_id;
    if (openStatus && blockingStatuses.includes(openStatus)) return Response.json({ status: "blocked", error: "Already active" });
    if (openStatus === "created") return Response.json({ status: "reuse", subscription_id: "sub_existing" });
    if (saved) return Response.json({ status: "reuse", subscription_id: saved.provider_subscription_id });
    if (claimStatus === "blocked") return Response.json({ status: "blocked", error: "Already active" });
    if (reserved) return Response.json({ status: "busy", error: "Checkout in progress" });
    reserved = true;
    return Response.json({ status: "claimed" });
  }
  if (url.pathname.endsWith("/razorpay_plans")) {
    if (init?.method === "POST") {
      return Response.json(planInsertError ? { code: planInsertError, message: "Synthetic insert error" } : null,
        { status: planInsertError ? 409 : 201 });
    }
    planReads++;
    if (planLookupFails && (planExists || planReads > 1)) {
      return Response.json({ code: "SYNTHETIC_LOOKUP_ERROR", message: "Synthetic plan lookup error" }, { status: 500 });
    }
    return Response.json(planExists ? { provider_plan_id: "plan_test" } : null);
  }
  if (url.hostname === "api.razorpay.com" && url.pathname === "/v1/plans") {
    planProviderCalls++;
    return Response.json(planFails ? {} : { id: "plan_test" }, { status: planFails ? 400 : 200 });
  }
  if (url.hostname === "api.razorpay.com" && url.pathname === "/v1/subscriptions") {
    providerCalls++;
    expect(reserved).toBe(true);
    expect(body).toMatchObject({ plan_id: "plan_test", notes: { user_id: "test-user", plan_code: "monthly" } });
    providerEntered();
    await providerGate;
    if (providerThrows) throw new Error("Synthetic provider timeout");
    return Response.json(providerStatus >= 400 ? { error: { code: "SYNTHETIC_PROVIDER_ERROR" } }
      : { id: "sub_test", status: "created" }, { status: providerStatus });
  }
  if (url.hostname === "api.razorpay.com" && url.pathname === "/v1/subscriptions/sub_test/cancel") {
    cancelCalls++;
    cancelRequest = { method: init?.method, authorization: new Headers(init?.headers).get("Authorization"), body };
    cancelSignal = init?.signal;
    cancelEntered();
    if (cancelStalls) {
      return new Promise<Response>((_resolve, reject) => {
        cancelSignal?.addEventListener("abort", () => reject(cancelSignal?.reason), { once: true });
      });
    }
    if (cancelThrows) throw new Error("Synthetic cancellation timeout");
    return Response.json({ status: cancelStatus === 200 ? "cancelled" : "error" }, { status: cancelStatus });
  }
  if (url.pathname.endsWith("/subscriptions")) {
    if (init?.method !== "POST") {
      raceReads++;
      if (raceLookupError) return Response.json({ message: "Synthetic race lookup error" }, { status: 500 });
      return Response.json({ provider_subscription_id: "sub_existing", status: raceStatus });
    }
    if (raceStatus || raceLookupError) return Response.json({ code: "23505", message: "Concurrent legacy checkout" }, { status: 409 });
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

const checkout = (planCode = "monthly") => handler(new Request("https://checkout.invalid", {
  method: "POST", headers: { Authorization: "Bearer synthetic-user-token" },
  body: JSON.stringify({ plan_code: planCode }),
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
  lifetimeReserved = false;
  lifetimeSaved = null;
  orderCalls = claimCalls = 0;
  orderMalformed = false;
  authenticated = true;
  claimStatus = "claimed";
  reserved = false;
  saved = null;
  providerCalls = 0;
  cancelCalls = 0;
  cancelStatus = 200;
  cancelThrows = false;
  cancelStalls = false;
  cancelSignal = null;
  cancelEntered = () => {};
  cancelRequest = null;
  claimError = null;
  openStatus = raceStatus = null;
  raceLookupError = false;
  raceReads = 0;
  saveError = providerThrows = planFails = false;
  planLookupFails = false;
  planInsertError = null;
  planReads = planProviderCalls = 0;
  requestId = "";
  planExists = true;
  providerStatus = 200;
  providerGate = Promise.resolve();
  providerEntered = () => {};
  vi.stubGlobal("fetch", vi.fn(fakeFetch));
});
afterEach(() => vi.restoreAllMocks());
afterAll(() => vi.unstubAllGlobals());

describe("monthly checkout reservation", () => {
  it("returns 409 without calling Razorpay for a blocked account", async () => {
    claimStatus = "blocked";
    expect((await checkout()).status).toBe(409);
    expect(providerCalls).toBe(0);
  });
  it.each(["entitlements", "subscriptions"])("fails closed when the atomic %s check fails", async (table) => {
    claimError = table;
    expect((await checkout()).status).toBe(502);
    expect(providerCalls).toBe(0);
  });
  it("reuses the created provider subscription on subsequent checkout", async () => {
    expect((await checkout()).status).toBe(200);
    expect(await (await checkout()).json()).toMatchObject({ subscription_id: "sub_test" });
    expect(providerCalls).toBe(1);
    expect(cancelCalls).toBe(0);
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
  it.each(["success", "rejected", "timeout"])("fails checkout after a save error when cancellation ends in %s", async (outcome) => {
    saveError = true;
    cancelStatus = outcome === "rejected" ? 500 : 200;
    cancelThrows = outcome === "timeout";
    const response = await checkout();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Internal server error" });
    expect(cancelCalls).toBe(1);
    expect(cancelRequest).toEqual({
      method: "POST", authorization: `Basic ${btoa("synthetic-key:synthetic-secret")}`,
      body: { cancel_at_cycle_end: 0 },
    });
    expect(saved).toBeNull();
    expect(reserved).toBe(true);
    expect((await checkout()).status).toBe(409);
    expect(providerCalls).toBe(1);
    expect(cancelCalls).toBe(1);
  });
  it("aborts a stalled cancellation and returns 500 while retaining the reservation", async () => {
    vi.useFakeTimers();
    try {
      saveError = cancelStalls = true;
      const entered = new Promise<void>((resolve) => { cancelEntered = resolve; });
      let settled = false;
      const pending = checkout().then((response) => { settled = true; return response; });
      await entered;
      expect(cancelSignal).toBeInstanceOf(AbortSignal);
      expect(cancelSignal?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(4_999);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      const response = await pending;
      expect(cancelSignal?.aborted).toBe(true);
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: "Internal server error" });
      expect(saved).toBeNull();
      expect(reserved).toBe(true);
      expect((await checkout()).status).toBe(409);
      expect(providerCalls).toBe(1);
      expect(cancelCalls).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
  it("releases a reservation if plan creation fails before subscription creation", async () => {
    planExists = false;
    planFails = true;
    expect((await checkout()).status).toBe(502);
    expect(reserved).toBe(false);
    expect(providerCalls).toBe(0);
  });
  it("fails before creating a provider plan when the initial plan lookup fails", async () => {
    planLookupFails = true;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await checkout()).status).toBe(502);
    expect(planProviderCalls).toBe(0);
    expect(providerCalls).toBe(0);
    expect(reserved).toBe(false);
    expect(log).toHaveBeenCalledWith("create-order: razorpay_plans lookup failed", "SYNTHETIC_LOOKUP_ERROR", requestId);
  });
  it.each(["23505", "SYNTHETIC_INSERT_ERROR"])("fails before subscription creation when retry lookup fails after insert error %s", async (code) => {
    planExists = false;
    planInsertError = code;
    planLookupFails = true;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await checkout()).status).toBe(502);
    expect(planReads).toBe(2);
    expect(planProviderCalls).toBe(1);
    expect(providerCalls).toBe(0);
    expect(saved).toBeNull();
    expect(reserved).toBe(false);
    expect(log).toHaveBeenCalledWith("create-order: razorpay_plans retry lookup failed", "SYNTHETIC_LOOKUP_ERROR", requestId);
  });
  it.each([400, 408, 500])("logs the request ID on provider status %s for reconciliation", async (status) => {
    providerStatus = status;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await checkout()).status).toBe(502);
    expect(log).toHaveBeenCalledWith("create-order: Razorpay subscription creation failed", status, "SYNTHETIC_PROVIDER_ERROR", requestId);
    expect(reserved).toBe(status !== 400);
  });
});


describe("billable checkout guards and legacy race recovery", () => {
  it.each(blockingStatuses)("blocks a persisted %s subscription before provider calls", async (status) => {
    openStatus = status;
    expect((await checkout()).status).toBe(409);
    expect(providerCalls).toBe(0);
  });
  it("reuses a persisted created subscription before provider calls", async () => {
    openStatus = "created";
    const response = await checkout();
    expect(response.status).toBe(200);
    expect((await response.json()).subscription_id).toBe("sub_existing");
    expect(providerCalls).toBe(0);
  });
  it.each(blockingStatuses)("blocks a %s subscription found during legacy race recovery", async (status) => {
    raceStatus = status;
    expect((await checkout()).status).toBe(409);
    expect(providerCalls).toBe(1);
    expect(raceReads).toBe(1);
    expect(cancelCalls).toBe(0);
    expect(reserved).toBe(true);
  });
  it("reuses a created subscription found during legacy race recovery", async () => {
    raceStatus = "created";
    const response = await checkout();
    expect(response.status).toBe(200);
    expect((await response.json()).subscription_id).toBe("sub_existing");
    expect(providerCalls).toBe(1);
    // The newly created provider ID still needs reconciliation.
    expect(cancelCalls).toBe(0);
    expect(reserved).toBe(true);
  });
  it("fails closed when legacy race recovery cannot read the subscription", async () => {
    raceLookupError = true;
    expect((await checkout()).status).toBe(502);
    expect(cancelCalls).toBe(0);
    expect(reserved).toBe(true);
  });
});


describe("lifetime checkout reservation", () => {
  it("blocks active lifetime access before creating an order", async () => {
    claimStatus = "blocked";
    expect((await checkout("lifetime")).status).toBe(409);
    expect(orderCalls).toBe(0);
    expect(lifetimeSaved).toBeNull();
  });
  it("fails closed when the database entitlement/claim check fails", async () => {
    claimError = "entitlements";
    expect((await checkout("lifetime")).status).toBe(502);
    expect(orderCalls).toBe(0);
    expect(lifetimeSaved).toBeNull();
  });
  it("authenticates and validates the plan before claiming checkout", async () => {
    authenticated = false;
    expect((await checkout("lifetime")).status).toBe(401);
    authenticated = true;
    expect((await checkout("unknown")).status).toBe(400);
    expect(claimCalls).toBe(0);
    expect(orderCalls).toBe(0);
  });
  it("saves and reuses a trusted one-time order on subsequent checkout", async () => {
    const response = await checkout("lifetime");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ order_id: "order_test", amount: 5000, currency: "USD", plan_code: "lifetime" });
    expect(lifetimeSaved).toMatchObject({
      user_id: "test-user", provider_order_id: "order_test", provider_subscription_id: null,
      provider_payment_id: "order_test", amount_minor: 5000, currency: "USD", status: "pending",
    });
    expect(lifetimeReserved).toBe(false);
    expect(await (await checkout("lifetime")).json()).toMatchObject({ order_id: "order_test" });
    expect(orderCalls).toBe(1);
    expect(providerCalls).toBe(0);
  });
  it("creates only one provider order during concurrent checkout", async () => {
    let release!: () => void;
    providerGate = new Promise<void>((resolve) => { release = resolve; });
    const entered = new Promise<void>((resolve) => { providerEntered = resolve; });
    const first = checkout("lifetime");
    await entered;
    try {
      expect((await checkout("lifetime")).status).toBe(409);
      expect(orderCalls).toBe(1);
    } finally { release(); }
    expect((await first).status).toBe(200);
  });
  it.each(["timeout", "provider_408", "provider_500", "malformed_success", "save_error"])(
    "retains the reservation after %s and blocks another provider order", async (failure) => {
      providerThrows = failure === "timeout";
      providerStatus = failure === "provider_500" ? 500 : failure === "provider_408" ? 408 : 200;
      orderMalformed = failure === "malformed_success";
      saveError = failure === "save_error";
      expect((await checkout("lifetime")).status).toBe(providerThrows || saveError ? 500 : 502);
      expect(lifetimeReserved).toBe(true);
      expect(lifetimeSaved).toBeNull();
      expect((await checkout("lifetime")).status).toBe(409);
      expect(orderCalls).toBe(1);
    }
  );
  it("releases the reservation after a definitive provider rejection", async () => {
    providerStatus = 400;
    expect((await checkout("lifetime")).status).toBe(502);
    expect(lifetimeReserved).toBe(false);
    providerStatus = 200;
    expect((await checkout("lifetime")).status).toBe(200);
    expect(orderCalls).toBe(2);
  });
});
