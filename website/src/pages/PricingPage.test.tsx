/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

vi.mock("../lib/auth", () => ({
  useAuth: () => ({ user: { id: "test-user", email: "test@example.com", app_metadata: {} }, loading: false }),
}));

const mockCreateOrder = vi.fn();
const mockListEntitlements = vi.fn().mockResolvedValue([]);
vi.mock("../lib/api", () => ({
  createOrder: (...args: any[]) => mockCreateOrder(...args),
  listEntitlements: (...args: any[]) => mockListEntitlements(...args),
  PlanCode: {},
}));

describe("PricingPage monthly checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListEntitlements.mockResolvedValue([]);
    constructorOptions = undefined;
    mockCreateOrder.mockResolvedValue({
      key_id: "rzp_test",
      subscription_id: "sub_123",
      amount: 1200,
      currency: "USD",
      plan_code: "monthly",
    });
    class RazorpayMock {
      options: any;
      constructor(options: any) {
        this.options = options;
        capture(options);
      }
      open() {}
      on() {}
    }
    function capture(options: any) {
      constructorOptions = options;
    }
    (window as any).Razorpay = RazorpayMock;
  });

  afterEach(cleanup);

  let constructorOptions: any;

  async function renderPage() {
    const { PricingPage } = await import("./PricingPage");
    render(
      <MemoryRouter>
        <PricingPage />
      </MemoryRouter>
    );
  }

  it("disables purchases while entitlements are loading or cannot be verified", async () => {
    mockListEntitlements.mockReturnValue(new Promise(() => {}));
    await renderPage();
    expect(screen.getAllByText(/Checking account access/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Buy monthly/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Buy lifetime/i })).toBeNull();
  });

  it("blocks purchases when entitlement lookup fails", async () => {
    mockListEntitlements.mockRejectedValue(new Error("network error"));
    await renderPage();
    await waitFor(() => expect(screen.getAllByText(/Retry after reloading account status/i).length).toBeGreaterThan(0));
    expect(screen.getByText(/Could not verify your current entitlements/i)).toBeTruthy();
    expect(mockCreateOrder).not.toHaveBeenCalled();
  });

  it("disables both plans when lifetime access is already active", async () => {
    mockListEntitlements.mockResolvedValue([
      { plan_code: "lifetime", status: "lifetime_active", lifetime: true, subscription_period_end: null },
    ]);
    await renderPage();
    await waitFor(() => expect(screen.getAllByText(/Lifetime access already active/i).length).toBeGreaterThan(0));
    expect(screen.queryByRole("button", { name: /Buy monthly/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Buy lifetime/i })).toBeNull();
    expect(screen.queryByText(/Buy monthly/i)).toBeNull();
  });

  it("disables only monthly when a monthly subscription is already active", async () => {
    mockListEntitlements.mockResolvedValue([
      { plan_code: "monthly", status: "active", lifetime: false, subscription_period_end: new Date(Date.now() + 86400000).toISOString() },
    ]);
    await renderPage();
    await waitFor(() => expect(screen.getByText(/Monthly subscription is already active/i)).toBeTruthy());
    expect(screen.getByText(/Monthly subscription already active/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Buy monthly/i })).toBeNull();
    // Lifetime remains purchasable.
    expect(screen.getByRole("button", { name: /Buy lifetime/i })).toBeTruthy();
  });

  it("allows both purchase paths when there is no active entitlement", async () => {
    mockListEntitlements.mockResolvedValue([]);
    await renderPage();
    await waitFor(() => expect(screen.getByRole("button", { name: /Buy monthly/i })).toBeTruthy());
    expect(screen.getByRole("button", { name: /Buy lifetime/i })).toBeTruthy();
  });

  it("opens Razorpay Checkout with subscription_id for monthly", async () => {
    await renderPage();
    const user = userEvent.setup();
    const monthlyButton = await screen.findByRole("button", { name: /Buy monthly/i });
    await user.click(monthlyButton);
    await waitFor(() => expect(mockCreateOrder).toHaveBeenCalledWith("monthly"));
    await waitFor(() => expect(constructorOptions).toBeTruthy());
    expect(constructorOptions.subscription_id).toBe("sub_123");
    expect(constructorOptions.order_id).toBeUndefined();
  });

  it("creates a one-time order for lifetime", async () => {
    mockCreateOrder.mockResolvedValue({
      key_id: "rzp_test",
      order_id: "order_456",
      amount: 5000,
      currency: "USD",
      plan_code: "lifetime",
    });
    await renderPage();
    const user = userEvent.setup();
    const lifetimeButton = await screen.findByRole("button", { name: /Buy lifetime/i });
    await user.click(lifetimeButton);
    await waitFor(() => expect(mockCreateOrder).toHaveBeenCalledWith("lifetime"));
    await waitFor(() => expect(constructorOptions).toBeTruthy());
    expect(constructorOptions.order_id).toBe("order_456");
    expect(constructorOptions.subscription_id).toBeUndefined();
  });
});