import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("https://esm.sh/@supabase/supabase-js@2.49.0", () => ({ createClient: mock.createClient }));

const secretRaw = "mysecret";
const secretEnv = `whsec_${btoa(secretRaw)}`;

async function sign(body: string, id: string, timestamp: number) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secretRaw), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${timestamp}.${body}`));
  const binary = String.fromCharCode(...new Uint8Array(digest));
  return `v1,${btoa(binary)}`;
}

let handler: any;

beforeAll(async () => {
  const env: Record<string, string> = {
    RESEND_WEBHOOK_SECRET: secretEnv,
    SUPABASE_URL: "https://supabase.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "synthetic-service-key",
  };
  vi.stubGlobal("Deno", {
    env: { get: (key: string) => env[key] },
    serve: (callback: any) => { handler = callback; },
  });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([]), { status: 200 })));
  await import("../functions/resend-webhook/index.ts");
});

afterAll(() => vi.unstubAllGlobals());

describe("resend webhook signature", () => {
  it("rejects missing headers", async () => {
    const res = await handler(new Request("https://webhook.invalid", { method: "POST", body: "{}" }));
    expect(res.status).toBe(401);
  });

  it("rejects invalid signature", async () => {
    const body = JSON.stringify({ type: "email.sent", data: { email_id: "msg_1" } });
    const res = await handler(new Request("https://webhook.invalid", {
      method: "POST",
      body,
      headers: { "svix-id": "msg_1", "svix-timestamp": String(Math.floor(Date.now() / 1000)), "svix-signature": "v1,AAAA" },
    }));
    expect(res.status).toBe(401);
  });

  it("rejects stale timestamp", async () => {
    const body = JSON.stringify({ type: "email.sent", data: { email_id: "msg_1" } });
    const id = "msg_1";
    const stale = Math.floor(Date.now() / 1000) - 1000;
    const signature = await sign(body, id, stale);
    const res = await handler(new Request("https://webhook.invalid", {
      method: "POST",
      body,
      headers: { "svix-id": id, "svix-timestamp": String(stale), "svix-signature": signature },
    }));
    expect(res.status).toBe(401);
  });

  it("acknowledges unknown event type after valid signature", async () => {
    const body = JSON.stringify({ type: "email.opened", data: { email_id: "msg_1" } });
    const id = "msg_2";
    const now = Math.floor(Date.now() / 1000);
    const signature = await sign(body, id, now);
    const res = await handler(new Request("https://webhook.invalid", {
      method: "POST",
      body,
      headers: { "svix-id": id, "svix-timestamp": String(now), "svix-signature": signature },
    }));
    expect(res.status).toBe(200);
  });
});


describe("resend webhook database processing", () => {
  let calls: Array<{ table: string; action: string; payload?: any; filters: Array<[string, unknown]> }>;
  let eventStatus: string | null;
  let outboxStatus: string | null;
  let claimLost: boolean;
  let outboxError: boolean;
  let outboxExists: boolean;
  let lookupError: boolean;
  let eventReceivedAt: string;
  let appearsOnLookup: boolean;

  beforeEach(() => {
    calls = [];
    eventStatus = null;
    outboxStatus = null;
    claimLost = false;
    outboxError = false;
    outboxExists = true;
    lookupError = false;
    eventReceivedAt = new Date().toISOString();
    appearsOnLookup = false;
    mock.createClient.mockImplementation(() => ({
      from(table: string) {
        let action = "select";
        let payload: any;
        const filters: Array<[string, unknown]> = [];
        const execute = () => {
          calls.push({ table, action, payload, filters: [...filters] });
          if (table === "email_outbox") {
            if (action === "select") {
              if (appearsOnLookup) outboxExists = true;
              return { data: outboxExists ? [{ id: "outbox", delivery_status: outboxStatus }] : [], error: lookupError ? new Error("lookup failed") : null };
            }
            if (outboxError) return { data: null, error: new Error("update failed") };
            const filter = filters.find(([name]) => name === "or")?.[1] as string;
            const eligible = filter.match(/in\.\(([^)]*)\)/)?.[1].split(",") ?? [];
            const updated = outboxExists && (!outboxStatus || eligible.includes(outboxStatus));
            if (updated) outboxStatus = payload.delivery_status;
            return { data: updated ? [{ id: "outbox" }] : [], error: null };
          }
          if (action === "select") return { data: eventStatus ? { id: "event", processing_status: eventStatus } : null, error: null };
          if (action === "insert") { eventStatus = "received"; return { data: null, error: null }; }
          if (payload.processing_status === "processing") {
            if (claimLost) return { data: [], error: null };
            eventStatus = "processing";
            return { data: [{ id: "event", received_at: eventReceivedAt }], error: null };
          }
          eventStatus = payload.processing_status;
          return { data: [{ id: "event" }], error: null };
        };
        const query: any = {
          select: () => query,
          insert: (value: any) => { action = "insert"; payload = value; return query; },
          update: (value: any) => { action = "update"; payload = value; return query; },
          eq: (name: string, value: unknown) => { filters.push([name, value]); return query; },
          in: (name: string, value: unknown) => { filters.push([name, value]); return query; },
          lt: (name: string, value: unknown) => { filters.push([name, value]); return query; },
          or: (value: string) => { filters.push(["or", value]); return query; },
          maybeSingle: async () => execute(),
          then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(execute()).then(resolve, reject),
        };
        return query;
      },
    }));
  });

  async function dispatch(type = "email.delivered", id = "evt_1") {
    const body = JSON.stringify({ type, data: { email_id: "msg_1" } });
    const now = Math.floor(Date.now() / 1000);
    return handler(new Request("https://webhook.invalid", { method: "POST", body, headers: {
      "svix-id": id, "svix-timestamp": String(now), "svix-signature": await sign(body, id, now),
    } }));
  }

  it("updates the matching outbox row and finalizes a signed event", async () => {
    const res = await dispatch();
    expect(res.status).toBe(200);
    expect(outboxStatus).toBe("delivered");
    expect(calls).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: "email_outbox", action: "update", payload: expect.objectContaining({ delivery_status: "delivered" }), filters: expect.arrayContaining([["provider_message_id", "msg_1"]]) }),
      expect.objectContaining({ table: "webhook_events", action: "update", payload: expect.objectContaining({ processing_status: "processed" }) }),
    ]));
  });

  it("acknowledges a duplicate svix id without updating the outbox", async () => {
    eventStatus = "processed";
    const res = await dispatch();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "duplicate" });
    expect(calls.some((call) => call.table === "email_outbox")).toBe(false);
  });

  it("returns 503 when another worker holds the claim", async () => {
    eventStatus = "processing";
    claimLost = true;
    const res = await dispatch();
    expect(res.status).toBe(503);
    expect(calls.filter((call) => call.payload?.processing_status === "processing")).toHaveLength(2);
    expect(calls.some((call) => call.table === "email_outbox")).toBe(false);
  });

  it("returns 500 and marks the event failed when the outbox update fails", async () => {
    outboxError = true;
    const res = await dispatch();
    expect(res.status).toBe(500);
    expect(eventStatus).toBe("failed");
    expect(calls).toEqual(expect.arrayContaining([expect.objectContaining({ table: "webhook_events", payload: expect.objectContaining({ processing_status: "failed" }) })]));
  });

  it("does not let a lower-ranked event overwrite a higher status", async () => {
    outboxStatus = "bounced";
    const res = await dispatch("email.sent");
    expect(res.status).toBe(200);
    expect(outboxStatus).toBe("bounced");
    expect(calls.find((call) => call.table === "email_outbox" && call.action === "update")?.filters).toContainEqual(["or", "delivery_status.is.null,delivery_status.in.(sent)"]);
    expect(calls).toEqual(expect.arrayContaining([expect.objectContaining({ table: "email_outbox", action: "select", filters: expect.arrayContaining([["provider_message_id", "msg_1"]]) })]));
    expect(eventStatus).toBe("processed");
  });

  it("updates a row that appears between the conditional update and lookup", async () => {
    outboxExists = false;
    appearsOnLookup = true;
    const res = await dispatch();
    expect(res.status).toBe(200);
    expect(outboxStatus).toBe("delivered");
    expect(calls.filter((call) => call.table === "email_outbox" && call.action === "update")).toHaveLength(2);
    expect(eventStatus).toBe("processed");
  });

  it("retries a recent unmatched event, then processes it when the row appears", async () => {
    outboxExists = false;
    const first = await dispatch();
    expect(first.status).toBe(500);
    expect(eventStatus).toBe("failed");
    expect(calls.some((call) => call.payload?.processing_status === "processed")).toBe(false);
    outboxExists = true;
    const retry = await dispatch();
    expect(retry.status).toBe(200);
    expect(outboxStatus).toBe("delivered");
    expect(eventStatus).toBe("processed");
  });

  it("acknowledges an unmatched event after the window measured from initial receipt", async () => {
    outboxExists = false;
    eventStatus = "failed";
    eventReceivedAt = new Date(Date.now() - 5 * 60_000 - 1000).toISOString();
    const res = await dispatch();
    expect(res.status).toBe(200);
    expect(eventStatus).toBe("processed");
  });

  it("retries when the matching-row lookup fails", async () => {
    outboxStatus = "bounced";
    lookupError = true;
    const res = await dispatch("email.sent");
    expect(res.status).toBe(500);
    expect(eventStatus).toBe("failed");
  });

  it("retries rather than silently acknowledging an invalid receipt timestamp", async () => {
    outboxExists = false;
    eventReceivedAt = "invalid";
    const res = await dispatch();
    expect(res.status).toBe(500);
    expect(eventStatus).toBe("failed");
  });
});
