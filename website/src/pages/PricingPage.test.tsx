/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

vi.mock("../lib/auth", () => ({
  useAuth: () => ({ user: { id: "test-user", email: "test@example.com", app_metadata: {} }, loading: false }),
}));

const mockCreateOrder = vi.fn();
vi.mock("../lib/api", () => ({
  createOrder: (...args: any[]) => mockCreateOrder(...args),
  PlanCode: {},
}));

describe("PricingPage monthly checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  let constructorOptions: any;

  async function renderPage() {
    const { PricingPage } = await import("./PricingPage");
    render(
      <MemoryRouter>
        <PricingPage />
      </MemoryRouter>
    );
  }

  it("opens Razorpay Checkout with subscription_id for monthly", async () => {
    await renderPage();
    const user = userEvent.setup();
    const monthlyButton = screen.getAllByRole("button", { name: /Buy monthly/i })[0]!;
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
    const lifetimeButton = screen.getAllByRole("button", { name: /Buy lifetime/i })[0]!;
    await user.click(lifetimeButton);
    await waitFor(() => expect(mockCreateOrder).toHaveBeenCalledWith("lifetime"));
    await waitFor(() => expect(constructorOptions).toBeTruthy());
    expect(constructorOptions.order_id).toBe("order_456");
    expect(constructorOptions.subscription_id).toBeUndefined();
  });
});