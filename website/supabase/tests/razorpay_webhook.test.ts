import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Exercise the actual handler and query builder with synthetic PostgREST responses.
vi.mock("https://esm.sh/@supabase/supabase-js@2.49.0", async () => import("@supabase/supabase-js"));

type LedgerRow = Record<string, string>;
let handler: (request: Request) => Promise<Response>;
let ledger: LedgerRow;
let loseClaim: boolean;
let unknownUser: boolean;
let paymentError: boolean;
let dbError: boolean;
let subscription: Record<string, unknown> | null;
let subscriptionReadError: boolean;
let concurrentSubscription: Record<string, unknown> | null;
let grantCalls: number;
let subscriptionWrites: Record<string, unknown>[];
let statusWrites: { token: string | null; count: number }[];
const priorToken = "11111111-1111-4111-8111-111111111111";
const nextToken = "22222222-2222-4222-8222-222222222222";
const secret = "synthetic-webhook-secret";

function matchesFilters(row: Record<string, unknown>, params: URLSearchParams): boolean {
  function matches(column: string, filter: string): boolean {
    const value = row[column];
    if (filter === "is.null") return value == null;
    if (filter.startsWith("eq.")) return value === filter.slice(3);
    if (filter.startsWith("lt.")) return value != null && String(value) < filter.slice(3);
    if (filter.startsWith("lte.")) return value != null && String(value) <= filter.slice(4);
    if (filter.startsWith("in.(")) return filter.slice(4, -1).split(",").includes(String(value));
    throw new Error(`Unexpected filter: ${column}=${filter}`);
  }
  return [...params].every(([column, filter]) => {
    if (column === "select") return true;
    if (column === "or") return filter.slice(1, -1).split(",").some((condition) => {
      const separator = condition.indexOf(".");
      return matches(condition.slice(0, separator), condition.slice(separator + 1));
    });
    return matches(column, filter);
  });
}

async function postgrest(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = new URL(String(input));
  const table = url.pathname.split("/").at(-1) ?? "";
  const body = init?.body ? JSON.parse(String(init.body)) : null;
  let rows: unknown[] = [];

  // RPC: atomic webhook provisioning. Claim token arrives in the request body.
  if (url.pathname.includes("/rpc/")) {
    grantCalls += 1;
    const rpcToken = body?.p_claim_token ? `eq.${body.p_claim_token}` : null;
    if (dbError || paymentError) {
      statusWrites.push({ token: rpcToken, count: 0 });
      return Response.json({ message: "Synthetic database error" }, { status: 500 });
    }
    if (loseClaim) {
      ledger.claim_token = nextToken;
      ledger.processing_status = "processing";
      statusWrites.push({ token: rpcToken, count: 0 });
      return Response.json(0);
    }
    ledger.processing_status = "processed";
    statusWrites.push({ token: rpcToken, count: 1 });
    return Response.json(1);
  }

  if (table === "webhook_events") {
    const terminalWrite = body && body.processing_status !== "processing";
    if (terminalWrite && dbError) {
      statusWrites.push({ token: url.searchParams.get("claim_token"), count: 0 });
      return Response.json({ message: "Synthetic database error" }, { status: 500 });
    }
    if (terminalWrite && loseClaim) {
      ledger.claim_token = nextToken;
      ledger.processing_status = "processing";
    }
    const matches = matchesFilters(ledger, url.searchParams);
    if (matches) {
      if (body) Object.assign(ledger, body);
      rows = [{ ...ledger }];
    }
    if (terminalWrite) statusWrites.push({ token: url.searchParams.get("claim_token"), count: rows.length });
  } else if (table === "subscriptions") {
    if (!body && subscriptionReadError) {
      return Response.json({ message: "Synthetic subscription read error" }, { status: 500 });
    }
    if (body && init?.method === "POST") {
      if (subscription) return Response.json({ code: "23505", message: "Duplicate subscription" }, { status: 409 });
      subscription = { id: "subscription-test", ...body };
      subscriptionWrites.push(body);
    } else if (body) {
      if (concurrentSubscription) {
        subscription = { ...subscription, ...concurrentSubscription };
        concurrentSubscription = null;
      }
      if (subscription && matchesFilters(subscription, url.searchParams)) {
        Object.assign(subscription, body);
        subscriptionWrites.push(body);
        rows = [{ ...subscription }];
      }
    } else if (subscription && matchesFilters(subscription, url.searchParams)) {
      rows = [{ ...subscription }];
    }
  } else if (table === "profiles") {
    rows = unknownUser ? [] : [{ user_id: "test-user" }];
  } else if (table === "payments" && paymentError) {
    return Response.json({ message: "Synthetic payment error" }, { status: 500 });
  }
  const single = new Headers(init?.headers).get("Accept")?.includes("application/vnd.pgrst.object+json");
  if (single && rows.length !== 1) {
    return Response.json({ code: "PGRST116", message: "Expected one row" }, { status: 406 });
  }
  return Response.json(single ? rows[0] : rows);
}

async function deliver(eventType = "payment.captured", validPayload = true, options: {
  eventId?: string;
  omitSubscriptionEntity?: boolean;
  createdAt?: number;
  currentEnd?: number | null;
  subscriptionStatus?: string;
} = {}): Promise<Response> {
  const body = JSON.stringify({
    id: options.eventId ?? "evt_claim_1",
    event: eventType,
    created_at: options.createdAt,
    payload: { payment: { entity: {
      id: "pay_test", order_id: "order_test", subscription_id: "sub_test", status: "captured", currency: "USD",
      amount: validPayload ? 1200 : 1, notes: { user_id: "test-user" },
    } }, subscription: options.omitSubscriptionEntity ? undefined : { entity: {
      id: "sub_test", current_end: options.currentEnd === undefined ? 2000000000 : options.currentEnd,
      status: options.subscriptionStatus,
    } } },
  });
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const hex = Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return handler(new Request("https://webhook.invalid", {
    method: "POST", body, headers: { "x-razorpay-signature": hex },
  }));
}

beforeAll(async () => {
  const env: Record<string, string> = {
    RAZORPAY_WEBHOOK_SECRET: secret,
    SUPABASE_URL: "https://supabase.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "synthetic-service-key",
  };
  vi.stubGlobal("Deno", {
    env: { get: (key: string) => env[key] },
    serve: (callback: typeof handler) => { handler = callback; },
  });
  await import("../functions/razorpay-webhook/index");
});

beforeEach(() => {
  ledger = {
    id: "ledger-test", provider: "razorpay", provider_event_id: "evt_claim_1",
    processing_status: "processing", claim_token: priorToken,
    lease_expires_at: "2000-01-01T00:00:00.000Z",
  };
  loseClaim = false;
  unknownUser = false;
  paymentError = false;
  dbError = false;
  statusWrites = [];
  subscription = null;
  subscriptionReadError = false;
  concurrentSubscription = null;
  grantCalls = 0;
  subscriptionWrites = [];
  vi.stubGlobal("fetch", vi.fn(postgrest));
});

afterAll(() => vi.unstubAllGlobals());

describe("webhook signature validation", () => {
  it("rejects an invalid signature", async () => {
    const response = await handler(new Request("https://webhook.invalid", {
      method: "POST",
      body: '{"event":"payment.captured"}',
      headers: { "x-razorpay-signature": "00" },
    }));
    expect(response.status).toBe(401);
  });
});

describe("webhook claim ownership", () => {
  it.each(["received", "failed", "processing"])("rotates the token when claiming %s events and finalizes with it", async (status) => {
    ledger.processing_status = status;
    const response = await deliver();
    expect(response.status).toBe(200);
    expect(ledger.claim_token).not.toBe(priorToken);
    expect(ledger.processing_status).toBe("processed");
    expect(statusWrites).toEqual([{ token: `eq.${ledger.claim_token}`, count: 1 }]);
  });

  it("leaves a valid lease with its current worker", async () => {
    ledger.lease_expires_at = "2999-01-01T00:00:00.000Z";
    expect((await deliver()).status).toBe(503);
    expect(ledger.claim_token).toBe(priorToken);
    expect(statusWrites).toEqual([]);
  });

  it("acknowledges processed duplicates without reclaiming", async () => {
    ledger.processing_status = "processed";
    expect((await deliver()).status).toBe(200);
    expect(ledger.claim_token).toBe(priorToken);
    expect(statusWrites).toEqual([]);
  });

  it.each(["processed", "ignored", "invalid_payload", "unknown_user", "processing_exception"])("fences stale %s finalization", async (path) => {
    loseClaim = true;
    unknownUser = path === "unknown_user";
    paymentError = path === "processing_exception";
    const response = await deliver(path === "ignored" ? "payment.authorized" : "payment.captured", path !== "invalid_payload");
    expect(response.status).toBe(503);
    expect(ledger.claim_token).toBe(nextToken);
    expect(ledger.processing_status).toBe("processing");
    expect(statusWrites.length).toBeGreaterThan(0);
    for (const write of statusWrites) {
      expect(write.token).toMatch(/^eq\.[0-9a-f-]{36}$/);
      expect(write.token).not.toBe(`eq.${priorToken}`);
      expect(write.token).not.toBe(`eq.${nextToken}`);
      expect(write.count).toBe(0);
    }
  });

  it("returns 500 when a finalization database update fails", async () => {
    dbError = true;
    const response = await deliver();
    expect(response.status).toBe(500);
    expect(statusWrites.length).toBeGreaterThan(0);
  });

  it("returns 500 when payment provisioning fails", async () => {
    paymentError = true;
    const response = await deliver();
    expect(response.status).toBe(500);
  });

  it("does not provision on order.paid without a captured payment", async () => {
    const body = JSON.stringify({
      id: "evt_claim_1",
      event: "order.paid",
      payload: { payment: { entity: {
        id: "pay_test", order_id: "order_test", status: "created", currency: "USD",
        amount: 1200, notes: { user_id: "test-user" },
      } } },
    });
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
    const hex = Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const response = await handler(new Request("https://webhook.invalid", {
      method: "POST", body, headers: { "x-razorpay-signature": hex },
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ignored" });
  });
});

describe("subscription event ordering", () => {
  const older = 1800000000;
  const newer = older + 60;
  const timestamp = (unix: number) => new Date(unix * 1000).toISOString();

  function seedSubscription(status = "active", watermark: number | null = newer, periodEnd: number | null = 2000000000) {
    subscription = {
      id: "subscription-test", provider: "razorpay", provider_subscription_id: "sub_test",
      user_id: "test-user", status, last_event_created_at: watermark === null ? null : timestamp(watermark),
      current_period_end: periodEnd === null ? null : timestamp(periodEnd),
    };
  }

  it.each([{ omitSubscriptionEntity: true }, { currentEnd: null }])("rejects a monthly grant without a provider period end: %j", async (options) => {
    const response = await deliver("payment.captured", true, options);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "rejected", error: "Missing provider period end" });
    expect(ledger.processing_status).toBe("failed");
    expect(ledger.error_code).toBe("missing_period_end");
    expect(grantCalls).toBe(0);
    expect(subscriptionWrites).toEqual([]);
  });

  it("acknowledges a stale subscription event without changing the subscription", async () => {
    seedSubscription("cancelled");
    const before = { ...subscription };
    const response = await deliver("subscription.activated", true, { createdAt: older });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ignored", reason: "stale_event" });
    expect(ledger.processing_status).toBe("processed");
    expect(ledger.error_code).toBe("stale_event");
    expect(subscription).toEqual(before);
    expect(subscriptionWrites).toEqual([]);
  });

  it("enforces ordering when cancellation commits between the status read and update", async () => {
    seedSubscription("active", older - 60);
    concurrentSubscription = { status: "cancelled", last_event_created_at: timestamp(newer) };
    const response = await deliver("subscription.activated", true, { createdAt: older });
    expect(await response.json()).toEqual({ status: "ignored", reason: "stale_event" });
    expect(ledger.processing_status).toBe("processed");
    expect(ledger.error_code).toBe("stale_event");
    expect(subscription?.status).toBe("cancelled");
    expect(subscription?.last_event_created_at).toBe(timestamp(newer));
    expect(subscriptionWrites).toEqual([]);
  });

  it("fails a subscription event when its ordering read fails", async () => {
    seedSubscription();
    subscriptionReadError = true;
    const response = await deliver("subscription.cancelled", true, { createdAt: newer + 60 });
    expect(response.status).toBe(500);
    expect(ledger.processing_status).toBe("failed");
    expect(subscriptionWrites).toEqual([]);
  });

  it.each([null, older, newer])("applies a status event at or after watermark %s", async (watermark) => {
    seedSubscription("active", watermark);
    const response = await deliver("subscription.cancelled", true, { createdAt: newer });
    expect(await response.json()).toEqual({ status: "ignored" });
    expect(subscription?.status).toBe("cancelled");
    expect(subscription?.last_event_created_at).toBe(timestamp(newer));
  });

  it("does not let an event without a timestamp replace an ordered status", async () => {
    seedSubscription("cancelled");
    const response = await deliver("subscription.activated");
    expect(await response.json()).toEqual({ status: "ignored", reason: "stale_event" });
    expect(subscription?.status).toBe("cancelled");
  });

  it.each([null, 1900000000, 2000000000, 2100000000])("preserves cancellation after a late grant with stored period end %s", async (periodEnd) => {
    seedSubscription("active", older - 60, periodEnd);
    const cancelled = await deliver("subscription.cancelled", true, { createdAt: newer });
    expect(cancelled.status).toBe(200);
    expect(subscription?.status).toBe("cancelled");
    // Deliver a distinct, older captured-payment event against the same subscription.
    ledger.provider_event_id = "evt_late_grant";
    ledger.processing_status = "received";
    subscriptionWrites = [];
    const response = await deliver("subscription.charged", true, { createdAt: older, eventId: "evt_late_grant" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "processed" });
    expect(grantCalls).toBe(1);
    expect(subscription?.status).toBe("cancelled");
    expect(subscription?.last_event_created_at).toBe(timestamp(newer));
    expect(subscription?.current_period_end).toBe(timestamp(Math.max(periodEnd ?? 0, 2000000000)));
    expect(subscriptionWrites).toEqual(periodEnd === null || periodEnd < 2000000000
      ? [{ current_period_end: timestamp(2000000000) }] : []);
  });

  it("inserts subscription metadata for a first grant", async () => {
    const response = await deliver("payment.captured", true, { createdAt: newer });
    expect(response.status).toBe(200);
    expect(subscription?.status).toBe("active");
    expect(subscription?.last_event_created_at).toBe(timestamp(newer));
  });

  it("updates subscription metadata for a newer grant", async () => {
    seedSubscription("pending", older);
    const response = await deliver("subscription.charged", true, { createdAt: newer });
    expect(response.status).toBe(200);
    expect(subscription?.status).toBe("active");
    expect(subscription?.last_event_created_at).toBe(timestamp(newer));
  });

  it("preserves a cancellation committed before the grant update", async () => {
    seedSubscription("active", older - 60);
    concurrentSubscription = { status: "cancelled", last_event_created_at: timestamp(newer) };
    const response = await deliver("subscription.charged", true, { createdAt: older });
    expect(response.status).toBe(200);
    expect(subscription?.status).toBe("cancelled");
    expect(subscription?.last_event_created_at).toBe(timestamp(newer));
  });
});
