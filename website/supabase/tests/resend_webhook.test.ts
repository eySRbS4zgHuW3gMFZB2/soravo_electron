import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("https://esm.sh/@supabase/supabase-js@2.49.0", async () => import("@supabase/supabase-js"));

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
