/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAuth } = vi.hoisted(() => ({
  mockAuth: {
    getSession: vi.fn(),
    getUser: vi.fn(),
  },
}));

vi.mock("./supabase", () => ({
  supabase: {
    auth: mockAuth,
  },
  isConfigured: true,
}));

import { createOrder, createCheckoutOrder } from "./api";

const mockFetch = vi.fn();
globalThis.fetch = mockFetch as typeof fetch;

describe("Checkout order creation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockAuth.getSession.mockResolvedValue({
      data: { session: { access_token: "valid-test-token" } },
    });
  });

  it("calls create-order with the trusted plan code", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        key_id: "rzp_test",
        order_id: "order_123",
        amount: 1200,
        currency: "USD",
        plan_code: "monthly",
      }),
    });

    const result = await createOrder("monthly");
    expect(result.order_id).toBe("order_123");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://placeholder.supabase.co/functions/v1/create-order",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer valid-test-token",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ plan_code: "monthly" }),
      })
    );
  });

  it("throws when unauthenticated", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null } });
    await expect(createOrder("lifetime")).rejects.toThrow("Not authenticated");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("throws when the endpoint reports an error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Razorpay not configured" }),
    });
    await expect(createOrder("monthly")).rejects.toThrow("Razorpay not configured");
  });

  it("keeps createCheckoutOrder as an alias", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        key_id: "rzp_test",
        order_id: "order_456",
        amount: 5000,
        currency: "USD",
        plan_code: "lifetime",
      }),
    });
    const result = await createCheckoutOrder("lifetime");
    expect(result.order_id).toBe("order_456");
  });
});