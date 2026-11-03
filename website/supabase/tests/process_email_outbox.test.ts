import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({ createClient: vi.fn(), send: vi.fn() }));
vi.mock("https://esm.sh/@supabase/supabase-js@2.49.0", () => ({ createClient: mocked.createClient }));
vi.mock("../functions/_shared/email.ts", () => ({
  RESEND_TIMEOUT_MS: 15_000,
  renderTemplate: (key: string) => {
    if (key === "invalid") throw new Error("invalid template");
    return { subject: "subject", html: "html", text: "text" };
  },
  sendResendEmail: mocked.send,
}));

let handler: (request: Request) => Promise<Response>;
let env: Record<string, string>;
let rows: Array<Record<string, unknown>>;
let updates: Array<{ payload: Record<string, unknown>; filters: Array<[string, string, unknown]> }>;
let claimArgs: Record<string, unknown>;
let renewalRows: Array<{ id: string }>;
let renewalSequence: Array<Array<{ id: string }>>;
let renewalError: Error | null;

beforeAll(async () => {
  env = {
    SUPABASE_URL: "https://supabase.invalid",
    SUPABASE_SERVICE_ROLE_KEY: "synthetic-service-key",
    RESEND_API_KEY: "synthetic-resend-key",
  };
  vi.stubGlobal("Deno", {
    env: { get: (key: string) => env[key] },
    serve: (callback: typeof handler) => { handler = callback; },
  });
  await import("../functions/process-email-outbox/index.ts");
});

afterAll(() => vi.unstubAllGlobals());

beforeEach(() => {
  rows = [];
  updates = [];
  renewalRows = [{ id: "row-1" }];
  renewalSequence = [];
  renewalError = null;
  claimArgs = {};
  delete env.EMAIL_BATCH_SIZE;
  delete env.EMAIL_WORKER_SECRET;
  delete env.CRON_SECRET;
  mocked.send.mockReset().mockResolvedValue({ ok: true, messageId: "provider-1", retryable: false, statusCode: 200 });
  mocked.createClient.mockReset().mockImplementation(() => ({
    rpc: async (_name: string, args: Record<string, unknown>) => {
      claimArgs = args;
      return { data: rows, error: null };
    },
    from: (table: string) => {
      expect(table).toBe("email_outbox");
      let payload: Record<string, unknown> = {};
      const filters: Array<[string, string, unknown]> = [];
      const query = {
        update(value: Record<string, unknown>) { payload = value; return query; },
        eq(column: string, value: unknown) { filters.push(["eq", column, value]); return query; },
        gt(column: string, value: unknown) { filters.push(["gt", column, value]); return query; },
        select: async () => {
          updates.push({ payload, filters: [...filters] });
          return { data: renewalSequence.shift() ?? renewalRows, error: renewalError };
        },
        then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
          updates.push({ payload, filters: [...filters] });
          return Promise.resolve({ data: null, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  }));
});

function row(overrides: Record<string, unknown> = {}) {
  return { id: "row-1", user_id: "user-1", recipient_email: "alice@example.com", template_key: "welcome", idempotency_key: "outbox-key", status: "processing", attempt_count: 1, metadata: {}, claim_token: "unused", ...overrides };
}

function request() {
  return new Request("https://worker.invalid", { method: "POST", headers: { Authorization: "Bearer synthetic-service-key" } });
}

describe("process-email-outbox", () => {
  it("rejects unauthorized requests", async () => {
    const res = await handler(new Request("https://worker.invalid", { method: "POST" }));
    expect(res.status).toBe(401);
    expect(mocked.createClient).not.toHaveBeenCalled();
  });

  it("accepts service-role bearer and empty claims", async () => {
    const res = await handler(request());
    expect(res.status).toBe(200);
    expect((await res.json()).claimed).toBe(0);
  });

  it("accepts the configured worker secret in the dedicated header", async () => {
    env.EMAIL_WORKER_SECRET = "synthetic-worker-secret";
    const res = await handler(new Request("https://worker.invalid", { method: "POST", headers: { "x-email-worker-secret": "synthetic-worker-secret" } }));
    expect(res.status).toBe(200);
    expect((await handler(request())).status).toBe(401);
  });

  it("accepts CRON_SECRET as a bearer when the worker secret is unset", async () => {
    env.CRON_SECRET = "synthetic-cron-secret";
    const res = await handler(new Request("https://worker.invalid", { method: "POST", headers: { Authorization: "Bearer synthetic-cron-secret" } }));
    expect(res.status).toBe(200);
  });

  it("fences a send, passes the outbox key, and finalizes with the status column", async () => {
    env.EMAIL_BATCH_SIZE = "100";
    rows = [row()];
    const res = await handler(request());
    expect(await res.json()).toMatchObject({ claimed: 1, sent: 1, failed: 0 });
    expect(claimArgs.p_batch_size).toBe(100);
    expect(claimArgs.p_lease_seconds).toBeGreaterThan(100 * 15);
    expect(updates[0].payload).toHaveProperty("lease_expires_at");
    expect(updates[0].filters).toEqual(expect.arrayContaining([
      ["eq", "id", "row-1"], ["eq", "claim_token", claimArgs.p_claim_token],
      ["eq", "status", "processing"], ["gt", "lease_expires_at", expect.any(String)],
    ]));
    expect(mocked.send).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: "outbox-key" }));
    expect(mocked.send.mock.calls[0][0]).not.toHaveProperty("headers");
    expect(updates[1].payload).toMatchObject({ status: "sent", provider_message_id: "provider-1" });
    expect(updates[1].filters).toContainEqual(["eq", "status", "processing"]);
    expect(updates[1].filters).toContainEqual(["eq", "claim_token", claimArgs.p_claim_token]);
  });

  it("does not send when its claim has expired or been reclaimed", async () => {
    rows = [row()];
    renewalRows = [];
    const res = await handler(request());
    expect(await res.json()).toMatchObject({ claimed: 1, sent: 0, skipped: 1 });
    expect(mocked.send).not.toHaveBeenCalled();
    expect(updates).toHaveLength(1);
  });

  it("renews each row separately and skips a later lost claim", async () => {
    rows = [row(), row({ id: "row-2", idempotency_key: "another-key" })];
    renewalSequence = [[{ id: "row-1" }], []];
    const res = await handler(request());
    expect(await res.json()).toMatchObject({ claimed: 2, sent: 1, skipped: 1 });
    expect(mocked.send).toHaveBeenCalledTimes(1);
    expect(updates[2].filters).toContainEqual(["eq", "id", "row-2"]);
  });

  it("does not send if renewal fails", async () => {
    rows = [row()];
    renewalError = new Error("database error");
    const res = await handler(request());
    expect(await res.json()).toMatchObject({ sent: 0, failed: 1 });
    expect(mocked.send).not.toHaveBeenCalled();
  });

  it("uses the status column when scheduling a retry", async () => {
    rows = [row()];
    mocked.send.mockResolvedValue({ ok: false, retryable: true, statusCode: 429, errorCode: "rate_limit" });
    const res = await handler(request());
    expect(await res.json()).toMatchObject({ sent: 0, failed: 1 });
    expect(updates[1].payload).toMatchObject({ status: "failed_retryable", last_error_code: "rate_limit" });
    expect(updates[1].filters).toContainEqual(["eq", "status", "processing"]);
  });

  it.each([
    ["redacted recipient", { recipient_email: "[redacted]" }, "redacted_recipient"],
    ["invalid template", { template_key: "invalid" }, "invalid_template"],
  ])("uses the status column for %s", async (_label, overrides, code) => {
    rows = [row(overrides)];
    await handler(request());
    expect(mocked.send).not.toHaveBeenCalled();
    expect(updates[0].payload).toMatchObject({ status: "failed_permanent", last_error_code: code });
    expect(updates[0].filters).toContainEqual(["eq", "status", "processing"]);
    expect(updates[0].filters).toContainEqual(["eq", "claim_token", claimArgs.p_claim_token]);
  });
});
