import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("https://esm.sh/@supabase/supabase-js@2.49.0", async () => import("@supabase/supabase-js"));

let handler: (request: Request) => Promise<Response>;
let lookupError: string | null;
let openStatus: string | null;
let raceStatus: string | null;
let subscriptionReads: number;
let providerCalls: string[];
const blockingStatuses = ["authenticated", "active", "pending", "resumed"];

async function providerAndDatabase(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = new URL(String(input));
  if (url.hostname === "api.razorpay.com") {
    providerCalls.push(url.pathname);
    return Response.json({ id: "sub_new", status: "created" });
  }
  if (url.pathname === "/auth/v1/user") return Response.json({ id: "test-user" });
  const table = url.pathname.split("/").at(-1);
  if (table === lookupError) return Response.json({ message: "Synthetic lookup error" }, { status: 500 });
  if (table === "entitlements") return Response.json([]);
  if (table === "razorpay_plans") return Response.json({ provider_plan_id: "plan_monthly" });
  if (table === "subscriptions") {
    if (init?.method === "POST") return Response.json({ code: "23505", message: "Concurrent checkout" }, { status: 409 });
    subscriptionReads += 1;
    const status = subscriptionReads > 1 ? raceStatus : openStatus;
    const statusFilter = url.searchParams.get("status") ?? "";
    const matches = status && statusFilter.slice(4, -1).split(",").includes(status);
    // maybeSingle converts an empty array into null.
    return Response.json(matches ? [{ provider_subscription_id: "sub_existing", status }] : []);
  }
  throw new Error(`Unexpected request: ${init?.method ?? "GET"} ${url.pathname}`);
}

async function checkout(): Promise<Response> {
  return handler(new Request("https://checkout.invalid", {
    method: "POST", headers: { Authorization: "Bearer synthetic-token", "Content-Type": "application/json" },
    body: JSON.stringify({ plan_code: "monthly" }),
  }));
}

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
  lookupError = null;
  openStatus = null;
  raceStatus = null;
  subscriptionReads = 0;
  providerCalls = [];
  vi.stubGlobal("fetch", vi.fn(providerAndDatabase));
});
afterAll(() => vi.unstubAllGlobals());

describe("monthly checkout guards", () => {
  it.each(["entitlements", "subscriptions"])("fails closed when the %s lookup fails", async (table) => {
    lookupError = table;
    const response = await checkout();
    expect(response.status).toBe(502);
    expect(providerCalls).toEqual([]);
  });

  it.each(blockingStatuses)("blocks a persisted %s subscription before provider calls", async (status) => {
    openStatus = status;
    expect((await checkout()).status).toBe(409);
    expect(providerCalls).toEqual([]);
  });

  it("reuses a created checkout", async () => {
    openStatus = "created";
    const response = await checkout();
    expect(response.status).toBe(200);
    expect((await response.json()).subscription_id).toBe("sub_existing");
    expect(providerCalls).toEqual([]);
  });

  it.each(blockingStatuses)("blocks a %s subscription found during race recovery", async (status) => {
    raceStatus = status;
    expect((await checkout()).status).toBe(409);
    expect(subscriptionReads).toBe(2);
    expect(providerCalls).toEqual(["/v1/subscriptions"]);
  });

  it("reuses a created checkout found during race recovery", async () => {
    raceStatus = "created";
    const response = await checkout();
    expect(response.status).toBe(200);
    expect((await response.json()).subscription_id).toBe("sub_existing");
    expect(subscriptionReads).toBe(2);
  });
});
