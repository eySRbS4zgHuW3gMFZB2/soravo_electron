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
let statusWrites: { token: string | null; count: number }[];
const priorToken = "11111111-1111-4111-8111-111111111111";
const nextToken = "22222222-2222-4222-8222-222222222222";
const secret = "synthetic-webhook-secret";

async function postgrest(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = new URL(String(input));
  const table = url.pathname.split("/").at(-1) ?? "";
  const body = init?.body ? JSON.parse(String(init.body)) : null;
  let rows: unknown[] = [];

  // RPC: atomic webhook provisioning. Claim token arrives in the request body.
  if (url.pathname.includes("/rpc/")) {
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
    const matches = [...url.searchParams].every(([column, filter]) => {
      if (column === "select") return true;
      if (filter.startsWith("eq.")) return ledger[column] === filter.slice(3);
      if (filter.startsWith("lt.")) return ledger[column] < filter.slice(3);
      if (filter.startsWith("in.(")) return filter.slice(4, -1).split(",").includes(ledger[column]);
      throw new Error(`Unexpected filter: ${column}=${filter}`);
    });
    if (matches) {
      if (body) Object.assign(ledger, body);
      rows = [{ ...ledger }];
    }
    if (terminalWrite) statusWrites.push({ token: url.searchParams.get("claim_token"), count: rows.length });
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

async function deliver(eventType = "payment.captured", validPayload = true): Promise<Response> {
  const body = JSON.stringify({
    id: "evt_claim_1",
    event: eventType,
    payload: { payment: { entity: {
      id: "pay_test", order_id: "order_test", status: "captured", currency: "USD",
      amount: validPayload ? 1200 : 1, notes: { user_id: "test-user" },
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
  vi.stubGlobal("fetch", vi.fn(postgrest));
});

afterAll(() => vi.unstubAllGlobals());

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
});