import { describe, expect, it } from "vitest";
import { parseDesktopAuthTokenResponse } from "../../../src/renderer/src/auth/desktopAuthPrimitives";

describe("desktop auth token response compatibility", () => {
  it("uses the fixed magiclink type when the deployed function omits otp_type", () => {
    expect(parseDesktopAuthTokenResponse({ token_hash: "hashed-token", state: "expected-state" })).toEqual({
      tokenHash: "hashed-token",
      otpType: "magiclink",
    });
  });

  it("preserves an explicit OTP type for validation by the caller", () => {
    expect(parseDesktopAuthTokenResponse({ token_hash: "hashed-token", otp_type: "recovery" })).toEqual({
      tokenHash: "hashed-token",
      otpType: "recovery",
    });
  });

  it("rejects non-object responses", () => {
    expect(parseDesktopAuthTokenResponse(null)).toBeNull();
    expect(parseDesktopAuthTokenResponse([])).toBeNull();
  });
});
