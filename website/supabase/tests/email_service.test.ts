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
});
