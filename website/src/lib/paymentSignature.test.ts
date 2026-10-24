import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";

function hmacHex(secret: string, body: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

function signaturesMatch(a: string, b: string): boolean {
  const normalizedA = a.trim().toLowerCase();
  const normalizedB = b.trim().toLowerCase();
  if (normalizedA.length !== normalizedB.length) return false;
  let diff = 0;
  for (let i = 0; i < normalizedA.length; i++) diff |= normalizedA.charCodeAt(i) ^ normalizedB.charCodeAt(i);
  return diff === 0;
}

describe("Razorpay webhook signature contract mirror", () => {
  it("matches a valid HMAC-SHA256 signature", () => {
    const body = '{"event":"payment.captured"}';
    const secret = "whsec_test";
    const sig = hmacHex(secret, body);
    expect(signaturesMatch(sig, hmacHex(secret, body))).toBe(true);
  });
  it("rejects an invalid signature", () => {
    expect(signaturesMatch("00", "11")).toBe(false);
  });
  it("rejects a tampered replay body", () => {
    const secret = "whsec_test";
    const validSig = hmacHex(secret, '{"event":"payment.captured"}');
    const tamperedBody = '{"event":"payment.captured","amount":999}';
    expect(signaturesMatch(validSig, hmacHex(secret, tamperedBody))).toBe(false);
  });
});