/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
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
  afterEach(cleanup);

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

  it("retries a failed overview request and restores the dashboard", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "admin-1" }, loading: false, signOut: mockSignOut });
    mockOverview.mockRejectedValueOnce(new Error("Failed to load overview")).mockResolvedValue(OVERVIEW_FIXTURE);
    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    await screen.findByText("Failed to load overview");
    expect(screen.getByRole("link", { name: "Back to account" }).getAttribute("href")).toBe("/account");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await screen.findByText("Registered users");
    expect(mockOverview).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Failed to load overview")).toBeNull();
  });

  it.each([
    { section: "subscriptions", request: mockSubscriptions },
    { section: "devices", request: mockDevices },
  ])("navigates $section pages and respects the first and last page", async ({ section, request }) => {
    mockUseAuth.mockReturnValue({ user: { id: "admin-1" }, loading: false, signOut: mockSignOut });
    mockOverview.mockResolvedValue(OVERVIEW_FIXTURE);
    request.mockImplementation(async (page: number, pageSize: number) => ({
      [section]: [{
        id: `row-${page}`,
        userEmail: `page-${page}@example.com`,
        status: "active",
        device_id: `device-${page}`,
        last_seen_at: "2026-10-01T00:00:00.000Z",
      }],
      page,
      pageSize,
      total: 26,
    }));
    render(
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    );

    await screen.findByText("Registered users");
    fireEvent.click(screen.getByRole("button", { name: section }));
    await screen.findByText(/page-1@example.com/);
    expect(request).toHaveBeenLastCalledWith(1, 25);
    expect((screen.getByRole("button", { name: "Previous" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText(/page-2@example.com/);
    expect(request).toHaveBeenLastCalledWith(2, 25);
    expect((screen.getByRole("button", { name: "Next" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Previous" }) as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    await screen.findByText(/page-1@example.com/);
    expect(request).toHaveBeenLastCalledWith(1, 25);
    expect((screen.getByRole("button", { name: "Previous" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("submits user search without reloading the overview or losing input focus", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "admin-1" }, loading: false, signOut: mockSignOut });
    mockOverview.mockResolvedValue(OVERVIEW_FIXTURE);
    mockUsers.mockResolvedValue({ users: [], page: 1, pageSize: 25, total: 0 });
    render(<MemoryRouter><AdminPage /></MemoryRouter>);

    await screen.findByText("Registered users");
    fireEvent.click(screen.getByRole("button", { name: "users" }));
    const input = await screen.findByPlaceholderText("Search email or name");
    input.focus();
    fireEvent.change(input, { target: { value: "test@example.com" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => expect(mockUsers).toHaveBeenLastCalledWith(1, 25, "test@example.com"));
    expect(mockOverview).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(input);
    expect(screen.queryByText("Verifying admin access...")).toBeNull();
  });

  it("retries a failed section without reloading the overview", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "admin-1" }, loading: false, signOut: mockSignOut });
    mockOverview.mockResolvedValue(OVERVIEW_FIXTURE);
    mockUsers.mockRejectedValueOnce(new Error("Users unavailable"))
      .mockResolvedValue({ users: [], page: 1, pageSize: 25, total: 0 });
    render(<MemoryRouter><AdminPage /></MemoryRouter>);

    await screen.findByText("Registered users");
    fireEvent.click(screen.getByRole("button", { name: "users" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(mockUsers).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(mockOverview).toHaveBeenCalledTimes(1);
  });

  it("clears a section error when returning to a successful page", async () => {
    mockUseAuth.mockReturnValue({ user: { id: "admin-1" }, loading: false, signOut: mockSignOut });
    mockOverview.mockResolvedValue(OVERVIEW_FIXTURE);
    mockSubscriptions.mockImplementation(async (page: number) => {
      if (page === 2) throw new Error("Page unavailable");
      return { subscriptions: [{ id: "one", userEmail: "first@example.com", status: "active" }], total: 26 };
    });
    render(<MemoryRouter><AdminPage /></MemoryRouter>);

    await screen.findByText("Registered users");
    fireEvent.click(screen.getByRole("button", { name: "subscriptions" }));
    await screen.findByText(/first@example.com/);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Page unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    await waitFor(() => expect(mockSubscriptions).toHaveBeenLastCalledWith(1, 25));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(mockOverview).toHaveBeenCalledTimes(1);
  });

});
