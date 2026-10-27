import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth, mockFrom } = vi.hoisted(() => ({
  mockAuth: {
    getSession: vi.fn(),
    getUser: vi.fn(),
  },
  mockFrom: vi.fn(),
}));

vi.mock("./supabase", () => ({
  supabase: {
    auth: mockAuth,
    from: mockFrom,
  },
}));

import { registerDevice, listDevices, revokeDevice } from "./api";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch as typeof fetch;

/** Configure the chained device-list query mock to resolve with the supplied rows. */
function mockListDevices(data: unknown[]) {
  mockFrom.mockReturnValue({
    select: vi.fn(() => ({
      is: vi.fn(() => ({
        order: vi.fn().mockResolvedValue({ data, error: null }),
      })),
    })),
  });
}

describe("Device Registration API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockAuth.getSession.mockResolvedValue({
      data: { session: { access_token: "valid-test-token" } },
    });
  });

  it("registers device successfully with valid auth", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        device_id: "test-device-123",
        device_count: 1,
        limit_reached: false,
      }),
    });

    const result = await registerDevice("test-device-123", "My Device", "windows", "1.0.0");

    expect(result.success).toBe(true);
    expect(result.device_id).toBe("test-device-123");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://placeholder.supabase.co/functions/v1/register-device",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer valid-test-token",
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("rejects when not authenticated", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null } });

    await expect(registerDevice("test-device-123")).resolves.toMatchObject({
      success: false,
      error: "Not authenticated",
    });
  });

  it("propagates engine errors (device limit reached)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: false,
        device_id: "test-device-124",
        device_count: 3,
        limit_reached: true,
        error: "Device limit reached (max 3 for monthly plan)",
      }),
    });

    const result = await registerDevice("test-device-124", "New Device");

    expect(result.success).toBe(false);
    expect(result.limit_reached).toBe(true);
    expect(result.error).toContain("Device limit reached");
  });
});

describe("Device Listing API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockAuth.getSession.mockResolvedValue({
      data: { session: { access_token: "test-token" } },
    });
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  it("lists devices for authenticated user", async () => {
    mockListDevices([
      { id: "1", device_id: "dev-1", label: "Test", platform: "windows", last_seen_at: "2026-01-01" },
    ]);

    const devices = await listDevices();
    expect(devices).toHaveLength(1);
    expect(devices[0].device_id).toBe("dev-1");
  });

  it("throws when not authenticated", async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(listDevices()).rejects.toThrow("Not authenticated");
  });
});

describe("Device Revocation API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockAuth.getSession.mockResolvedValue({
      data: { session: { access_token: "valid-test-token" } },
    });
    mockAuth.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  it("revokes own device for authenticated user", async () => {
    mockFrom.mockReturnValue({
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        })),
      })),
    });

    await expect(revokeDevice("test-device-123")).resolves.toBeUndefined();
  });

  it("throws when not authenticated", async () => {
    mockAuth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(revokeDevice("dev-1")).rejects.toThrow("Not authenticated");
  });
});
