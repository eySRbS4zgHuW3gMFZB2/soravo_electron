import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

let emailModule: any;

beforeAll(async () => {
  vi.stubGlobal("Deno", { env: { get: () => undefined }, serve: () => {} });
  emailModule = await import("../functions/_shared/email.ts");
});

afterAll(() => vi.unstubAllGlobals());

describe("email service", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("Deno", { env: { get: () => undefined }, serve: () => {} });
  });

  it("fails when API key is missing", async () => {
    const result = await emailModule.sendEmail({ to: "a@example.com", subject: "s", html: "<p>x</p>", text: "x" });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("missing_api_key");
  });

  it("renders templates", () => {
    const rendered = emailModule.renderTemplate("payment_receipt", { plan: "monthly", amountDisplay: "12.00", currency: "USD", paymentReference: "pay_1" });
    expect(rendered.subject).toBe("Payment received - Soravo");
    expect(rendered.html).toContain("12.00");
    expect(rendered.text).toContain("pay_1");
  });

  it("rejects unknown template", () => {
    expect(() => emailModule.renderTemplate("nope")).toThrow();
  });

  it("handles successful provider response", async () => {
    vi.stubGlobal("Deno", { env: { get: (key: string) => (key === "RESEND_API_KEY" ? "rk_test" : undefined) }, serve: () => {} });
    (globalThis.fetch as any).mockResolvedValue(new Response(JSON.stringify({ id: "msg_1" }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const result = await emailModule.sendEmail({ to: "a@example.com", subject: "s", html: "<p>x</p>", text: "x" });
    expect(result.ok).toBe(true);
    expect(result.messageId).toBe("msg_1");
  });

  it("handles provider 4xx validation error", async () => {
    vi.stubGlobal("Deno", { env: { get: (key: string) => (key === "RESEND_API_KEY" ? "rk_test" : undefined) }, serve: () => {} });
    (globalThis.fetch as any).mockResolvedValue(new Response(JSON.stringify({ name: "validation_error" }), { status: 422 }));
    const result = await emailModule.sendEmail({ to: "a@example.com", subject: "s", html: "<p>x</p>", text: "x" });
    expect(result.ok).toBe(false);
    expect(result.retryable).toBe(false);
    expect(result.errorCode).toBe("validation_error");
  });

  it("marks rate limits retryable", async () => {
    vi.stubGlobal("Deno", { env: { get: () => "rk_test" } });
    vi.mocked(fetch).mockResolvedValue(new Response('{"name":"rate_limit"}', { status: 429 }));
    const result = await emailModule.sendEmail({ to: "a@example.com", subject: "s", html: "x", text: "x" });
    expect(result).toMatchObject({ ok: false, retryable: true, statusCode: 429, errorCode: "rate_limit" });
  });

  it.each([
    ["concurrent_idempotent_requests", true],
    ["invalid_idempotent_request", false],
    ["other_conflict", false],
  ])("classifies provider conflict %s", async (name, retryable) => {
    vi.stubGlobal("Deno", { env: { get: () => "rk_test" } });
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ name }), { status: 409 }));
    const result = await emailModule.sendEmail({ to: "a@example.com", subject: "s", html: "x", text: "x" });
    expect(result).toMatchObject({ ok: false, retryable, statusCode: 409, errorCode: name });
  });

  it("sends the idempotency key as an HTTP header, not an email header", async () => {
    vi.stubGlobal("Deno", { env: { get: () => "rk_test" } });
    vi.mocked(fetch).mockResolvedValue(new Response('{"id":"msg_1"}', { status: 200 }));
    await emailModule.sendEmail({ to: "a@example.com", subject: "s", html: "x", text: "x", idempotencyKey: "outbox-key", headers: { "X-Custom": "value" } });
    const request = vi.mocked(fetch).mock.calls[0][1]!;
    const headers = new Headers(request.headers);
    expect(headers.get("Idempotency-Key")).toBe("outbox-key");
    expect(headers.get("Authorization")).toBe("Bearer rk_test");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(JSON.parse(request.body as string).headers).toEqual({ "X-Custom": "value" });
    expect(request.body).not.toContain("outbox-key");
  });

  it("omits the idempotency header when no key is supplied", async () => {
    vi.stubGlobal("Deno", { env: { get: () => "rk_test" } });
    vi.mocked(fetch).mockResolvedValue(new Response('{"id":"msg_1"}', { status: 200 }));
    await emailModule.sendEmail({ to: "a@example.com", subject: "s", html: "x", text: "x" });
    expect(new Headers(vi.mocked(fetch).mock.calls[0][1]?.headers).has("Idempotency-Key")).toBe(false);
  });

  it("handles provider 5xx error", async () => {
    vi.stubGlobal("Deno", { env: { get: (key: string) => (key === "RESEND_API_KEY" ? "rk_test" : undefined) }, serve: () => {} });
    (globalThis.fetch as any).mockResolvedValue(new Response("server error", { status: 500 }));
    const result = await emailModule.sendEmail({ to: "a@example.com", subject: "s", html: "<p>x</p>", text: "x" });
    expect(result.ok).toBe(false);
    expect(result.retryable).toBe(true);
  });

  it("handles network timeout", async () => {
    vi.stubGlobal("Deno", { env: { get: (key: string) => (key === "RESEND_API_KEY" ? "rk_test" : undefined) }, serve: () => {} });
    (globalThis.fetch as any).mockRejectedValue(new DOMException("aborted", "AbortError"));
    const result = await emailModule.sendEmail({ to: "a@example.com", subject: "s", html: "<p>x</p>", text: "x" });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("timeout");
  });

  it("handles malformed provider response", async () => {
    vi.stubGlobal("Deno", { env: { get: (key: string) => (key === "RESEND_API_KEY" ? "rk_test" : undefined) }, serve: () => {} });
    (globalThis.fetch as any).mockResolvedValue(new Response("not-json", { status: 200 }));
    const result = await emailModule.sendEmail({ to: "a@example.com", subject: "s", html: "<p>x</p>", text: "x" });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe("malformed_response");
  });

  it("redacts recipient email", () => {
    expect(emailModule.redactEmail("alice@example.com")).toBe("al***@example.com");
  });

  it("uses support as the transactional reply-to", () => {
    expect(emailModule.EMAIL_REPLY_TO).toBe("support@soravo.xyz");
    const rendered = emailModule.renderTemplate("welcome");
    expect(rendered.html).toContain("Reply to support@soravo.xyz.");
  });

  it("sends the support reply-to to Resend", async () => {
    vi.stubGlobal("Deno", { env: { get: (key: string) => (key === "RESEND_API_KEY" ? "rk_test" : undefined) }, serve: () => {} });
    (globalThis.fetch as any).mockResolvedValue(
      new Response(JSON.stringify({ id: "msg_reply_to" }), { status: 200, headers: { "Content-Type": "application/json" } })
    );
    await emailModule.sendEmail({ to: "a@example.com", subject: "s", html: "<p>x</p>", text: "x" });
    const rawBody = JSON.parse((globalThis.fetch as any).mock.calls[0][1].body);
    expect(rawBody.reply_to).toBe("support@soravo.xyz");
  });
});
