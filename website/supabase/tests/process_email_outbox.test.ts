import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("https://esm.sh/@supabase/supabase-js@2.49.0", async () => import("@supabase/supabase-js"));

let handler: any;

beforeAll(async () => {
  const env: Record<string, string> = {
    SUPABASE_URL: "https://supabase.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "synthetic-service-key",
    RESEND_API_KEY: "",
  };
  vi.stubGlobal("Deno", {
    env: { get: (key: string) => env[key] },
    serve: (callback: any) => { handler = callback; },
  });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify([]), { status: 200 })));
  await import("../functions/process-email-outbox/index.ts");
});

afterAll(() => vi.unstubAllGlobals());

describe("process-email-outbox", () => {
  it("rejects unauthorized requests", async () => {
    const res = await handler(new Request("https://worker.invalid", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("accepts service-role bearer and empty claims", async () => {
    const res = await handler(new Request("https://worker.invalid", {
      method: "POST",
      headers: { Authorization: "Bearer synthetic-service-key" },
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.claimed).toBe(0);
  });
});
