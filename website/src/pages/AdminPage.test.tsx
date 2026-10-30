/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AdminPage } from "./AdminPage";

const mockUseAuth = vi.fn();
const mockSignOut = vi.fn();
const mockOverview = vi.fn();
const mockUsers = vi.fn();
const mockPayments = vi.fn();
const mockSubscriptions = vi.fn();
const mockDevices = vi.fn();
const mockAudit = vi.fn();

vi.mock("../lib/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("../lib/api", () => ({
  fetchAdminOverview: (...args: unknown[]) => mockOverview(...args),
  fetchAdminUsers: (...args: unknown[]) => mockUsers(...args),
  fetchAdminPayments: (...args: unknown[]) => mockPayments(...args),
  fetchAdminSubscriptions: (...args: unknown[]) => mockSubscriptions(...args),
  fetchAdminDevices: (...args: unknown[]) => mockDevices(...args),
  fetchAdminAudit: (...args: unknown[]) => mockAudit(...args),
}));

const OVERVIEW_FIXTURE = {
  totalUsers: 42,
  newUsers30d: 7,
  activeUsers: 5,
  activeDevices: 9,
  totalDevices: 12,
  lifetimeEntitlements: 3,
  monthlyEntitlements: 4,
  paymentTotalMinor: 12600,
  capturedPayments: 6,
  failedPayments: 1,
  refundedPayments: 0,
  totalPayments: 7,
  lifetimePaymentCount: 3,
  recurringPaymentCount: 3,
  lifetimePaymentTotalMinor: 15000,
  recurringPaymentTotalMinor: 12600,
  subscriptionBreakdown: { active: 4 },
  webhookBreakdown: { processed: 7 },
  newUsersByDay: [{ date: "2026-10-01", count: 2 }],
};

describe("AdminPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockSignOut.mockResolvedValue(undefined);
  });

  it("asks unauthenticated visitors to log in", async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, signOut: mockSignOut });
    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );
    await screen.findByText("Please log in.");
  });

  it("renders an access-denied state for ordinary users", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "user-1", email: "user@example.com" }, loading: false, signOut: mockSignOut });
    mockOverview.mockRejectedValue(new Error("Admin access denied"));
    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );
    await screen.findByRole("heading", { name: "Admin access denied" });
    expect(screen.getByText("Admin access denied.")).toBeTruthy();
  });

  it("renders overview metrics for an authorized admin", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "admin-1", email: "admin@example.com" }, loading: false, signOut: mockSignOut });
    mockOverview.mockResolvedValue(OVERVIEW_FIXTURE);
    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(mockOverview).toHaveBeenCalled());
    await screen.findByText("Registered users");
    expect(screen.getByText("42")).toBeTruthy();
    expect(screen.getByText("Recurring payment count")).toBeTruthy();
    // Sensitive dictation data must never be rendered.
    expect(screen.queryByText(/transcript|clipboard|keystroke|audio/i)).toBeNull();
  });

  it("loads user records when navigating to users", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "admin-1", email: "admin@example.com" }, loading: false, signOut: mockSignOut });
    mockOverview.mockResolvedValue(OVERVIEW_FIXTURE);
    mockUsers.mockResolvedValue({
      users: [{ userId: "u-1", email: "person@example.com", signupDate: "2026-01-01T00:00:00.000Z", entitlements: [], payments: { total: 0 }, devices: { active: 0, total: 0 } }],
      page: 1,
      pageSize: 25,
      total: 1,
    });
    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(mockOverview).toHaveBeenCalled());
    const usersButton = screen.getAllByRole("button").find((btn) => btn.textContent?.trim().toLowerCase() === "users");
    fireEvent.click(usersButton!);
    await screen.findByText("person@example.com");
  });
});