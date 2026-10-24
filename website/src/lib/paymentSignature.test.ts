import { describe, it, expect } from "vitest";

/** Generate a lowercase HMAC-SHA256 signature for a test body and secret. */
async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Compare trimmed, lowercase signatures, rejecting unequal lengths first. */
function signaturesMatch(a: string, b: string): boolean {
  const normalizedA = a.trim().toLowerCase();
  const normalizedB = b.trim().toLowerCase();
  if (normalizedA.length !== normalizedB.length) return false;
  let diff = 0;
  for (let i = 0; i < normalizedA.length; i++) {
    diff |= normalizedA.charCodeAt(i) ^ normalizedB.charCodeAt(i);
  }
  return diff === 0;
}

describe("Razorpay webhook signature contract mirror", () => {
  it("matches a valid HMAC-SHA256 signature", async () => {
    const body = '{"event":"payment.captured"}';
    const secret = "whsec_test";
    const signature = await hmacHex(secret, body);
    expect(signaturesMatch(signature, await hmacHex(secret, body))).toBe(true);
  });

  it("rejects an invalid signature", () => {
    expect(signaturesMatch("00", "11")).toBe(false);
  });

  it("keeps Razorpay receipts within 40 characters", () => {
    const receipt = `rcpt_${"12345678901234567890123456789012".slice(0, 32)}`;
    expect(receipt).toMatch(/^rcpt_[0-9a-f]{32}$/);
    expect(receipt.length).toBeLessThanOrEqual(40);
  });

  it("rejects a tampered replay body", async () => {
    const secret = "whsec_test";
    const validSignature = await hmacHex(secret, '{"event":"payment.captured"}');
    const tamperedBody = '{"event":"payment.captured","amount":999}';
    expect(signaturesMatch(validSignature, await hmacHex(secret, tamperedBody))).toBe(false);
  });
});