import { describe, it, expect, vi } from "vitest";

vi.mock("./supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: { access_token: "test-token" } } })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        is: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [{ id: "1", device_id: "dev-1", label: "Test", platform: "windows", last_seen_at: "2026-01-01" }], error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  },
}));

import { listDevices, revokeDevice } from "./api";

describe("Device API", () => {
  it("lists devices", async () => {
    const devices = await listDevices();
    expect(devices).toHaveLength(1);
    expect(devices[0].device_id).toBe("dev-1");
  });

  it("revokes a device", async () => {
    await expect(revokeDevice("dev-1")).resolves.toBeUndefined();
  });
});