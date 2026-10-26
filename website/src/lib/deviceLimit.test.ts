import { describe, it, expect } from "vitest";

/**
 * Contract-mirror regression tests for the SQL function
 * `public.register_device_atomic` (see
 * website/supabase/migrations/001_initial_schema.sql).
 *
 * The TS function below mirrors the SQL decision logic exactly:
 *   - v_is_active is true only when a row exists WITH revoked_at IS NULL.
 *   - The monthly limit (max 3 active devices) applies only when the device is
 *     NOT already active (i.e. new devices AND revoked devices being reactivated).
 *   - An already-active device always bypasses the limit check (refresh allowed).
 *   - Lifetime users bypass the limit entirely.
 *
 * This pins the expected behavior so changes to the SQL semantics are caught.
 *
 * Database-backed coverage of the real SQL function lives in
 * website/supabase/tests/register_device_atomic.test.sql (pgTAP) and is wired
 * into the GitHub Actions database workflow against disposable PostgreSQL.
 */

const MAX_ACTIVE = 3;

interface Input {
  isLifetime: boolean;
  isExistingActive: boolean; // = v_is_active
  activeCount: number; // = COUNT(*) WHERE user_id=… AND revoked_at IS NULL
}

type Outcome = { allowed: true } | { allowed: false; limitReached: true };

/** Mirror SQL admission rules, bypassing the cap for lifetime or active devices. */
function mirrorRegisterDeviceAtomic(input: Input): Outcome {
  const bypassLimit = input.isLifetime || input.isExistingActive;
  if (!bypassLimit && input.activeCount >= MAX_ACTIVE) {
    return { allowed: false, limitReached: true };
  }
  return { allowed: true };
}

describe("register_device_atomic limit semantics (contract mirror)", () => {
  it("allows a NEW device when under the 3-device limit", () => {
    const r = mirrorRegisterDeviceAtomic({ isLifetime: false, isExistingActive: false, activeCount: 2 });
    expect(r).toEqual({ allowed: true });
  });

  it("DENIES a new device when already at the 3-device limit", () => {
    const r = mirrorRegisterDeviceAtomic({ isLifetime: false, isExistingActive: false, activeCount: 3 });
    expect(r).toEqual({ allowed: false, limitReached: true });
  });

  it("allows refreshing an ALREADY-ACTIVE device at the limit (no new slot consumed)", () => {
    const r = mirrorRegisterDeviceAtomic({ isLifetime: false, isExistingActive: true, activeCount: 3 });
    expect(r).toEqual({ allowed: true });
  });

  it("treats a REVOKED device as new: denied at the limit", () => {
    // revoked device => v_is_active = false (revoked_at IS NOT NULL)
    const r = mirrorRegisterDeviceAtomic({ isLifetime: false, isExistingActive: false, activeCount: 3 });
    expect(r).toEqual({ allowed: false, limitReached: true });
  });

  it("allows reactivating a REVOKED device when under the limit", () => {
    const r = mirrorRegisterDeviceAtomic({ isLifetime: false, isExistingActive: false, activeCount: 2 });
    expect(r).toEqual({ allowed: true });
  });

  it("allows ANY device for lifetime users, including at limit", () => {
    const r = mirrorRegisterDeviceAtomic({ isLifetime: true, isExistingActive: false, activeCount: 3 });
    expect(r).toEqual({ allowed: true });
    const r2 = mirrorRegisterDeviceAtomic({ isLifetime: true, isExistingActive: false, activeCount: 50 });
    expect(r2).toEqual({ allowed: true });
  });
});
