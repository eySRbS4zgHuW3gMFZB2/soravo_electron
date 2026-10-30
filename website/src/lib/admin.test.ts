import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth } = vi.hoisted(() => ({
  mockAuth: { getSession: vi.fn() },
}));

vi.mock("./supabase", () => ({
  supabase: { auth: mockAuth },
}));

import {
  fetchAdminOverview,
  fetchAdminUsers,
  fetchAdminPayments,
  fetchAdminSubscriptions,
  fetchAdminDevices,
  fetchAdminAudit,
} from "./api";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch as typeof fetch;

describe("Admin API helpers", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockAuth.getSession.mockResolvedValue({
      data: { session: { access_token: "admin-test-token" } },
    });
  });

  it("returns overview data for an authorized admin", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ totalUsers: 10, activeDevices: 3 }),
    });
    const data = await fetchAdminOverview();
    expect(data.totalUsers).toBe(10);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://placeholder.supabase.co/functions/v1/admin-dashboard",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer admin-test-token" }),
        body: JSON.stringify({ action: "overview" }),
      })
    );
  });

  it("throws a denial error when the function rejects access", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: "Admin access denied" }),
    });
    await expect(fetchAdminOverview()).rejects.toThrow("Admin access denied");
  });

  it("throws when there is no session", async () => {
    mockAuth.getSession.mockResolvedValueOnce({ data: { session: null } });
    await expect(fetchAdminOverview()).rejects.toThrow("Not authenticated");
  });

  it("sends pagination and search parameters for users", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ users: [] }) });
    await fetchAdminUsers(2, 10, "someone");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ action: "users", page: 2, pageSize: 10, q: "someone" }),
      })
    );
  });

  it("does not expose service-role usage in browser requests", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ payments: [] }) });
    await fetchAdminPayments(1, 25);
    const [, init] = mockFetch.mock.calls[0];
    expect(JSON.stringify(init)).not.toMatch(/service.?role/i);
  });
});