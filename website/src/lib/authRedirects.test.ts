/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getAuthRedirectOrigin,
  getAuthRedirectUrl,
  isAllowedAuthRedirectOrigin,
  isValidAuthOrigin,
  normalizeAuthRedirectPath,
  parseSupabaseAuthCallback,
  sanitizeAuthErrorMessage,
} from "./authRedirects";

describe("auth redirect helpers", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: new URL("http://localhost:5173"),
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
    vi.unstubAllEnvs();
  });

  it("uses the runtime origin when no site URL is configured", () => {
    vi.stubEnv("VITE_SITE_URL", "");
    expect(getAuthRedirectOrigin(undefined, "http://localhost:5173")).toBe("http://localhost:5173");
    expect(getAuthRedirectUrl("/account")).toBe("http://localhost:5173/account");
  });

  it("prefers a valid configured site origin", () => {
    expect(getAuthRedirectOrigin("https://soravo.xyz", "http://localhost:5173")).toBe("https://soravo.xyz");
    expect(getAuthRedirectUrl("/account", "https://soravo.xyz")).toBe("https://soravo.xyz/account");
  });

  it("rejects arbitrary origins", () => {
    expect(isValidAuthOrigin("https://evil.example")).toBe(true); // syntactically valid, but not allowlisted
    expect(isAllowedAuthRedirectOrigin("https://evil.example", ["https://soravo.xyz"])).toBe(false);
    expect(isAllowedAuthRedirectOrigin("https://soravo.xyz", ["https://soravo.xyz"])).toBe(true);
  });

  it("rejects unsafe or unknown paths", () => {
    expect(normalizeAuthRedirectPath("/admin")).toBe("/account");
    expect(normalizeAuthRedirectPath("https://evil.example/account")).toBe("/account");
    expect(normalizeAuthRedirectPath("/reset-password")).toBe("/reset-password");
  });

  it("classifies successful and failed callbacks", () => {
    const success = parseSupabaseAuthCallback("#access_token=abc&refresh_token=def&type=signup");
    expect(success.hasSuccessfulTokens).toBe(true);
    expect(success.type).toBe("signup");
    expect(success.isMalformed).toBe(false);

    const expired = parseSupabaseAuthCallback("#error=access_denied&error_code=otp_expired&error_description=expired");
    expect(expired.errorCode).toBe("access_denied");
    expect(expired.isMalformed).toBe(true);
  });

  it("does not leak provider text for malformed callbacks", () => {
    const message = sanitizeAuthErrorMessage("weird tokenish value");
    expect(message).toContain("invalid");
    expect(message).not.toContain("tokenish");
  });
});