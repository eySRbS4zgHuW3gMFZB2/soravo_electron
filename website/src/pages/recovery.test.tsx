/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mockAuth = vi.hoisted(() => ({
  getSession: vi.fn(),
  initialize: vi.fn().mockResolvedValue({}),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("../lib/supabase", () => ({
  supabase: { auth: mockAuth },
  isConfigured: true,
}));

import { AuthProvider } from "../lib/auth";
import { ForgotPasswordPage } from "./ForgotPasswordPage";
import { ResetPasswordPage } from "./ResetPasswordPage";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
  window.history.replaceState(null, "", "/");
});

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    mockAuth.onAuthStateChange.mockImplementation((cb?: (event: string, session: unknown) => void) => {
      if (cb) cb("SIGNED_OUT", null);
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
  });

  it("requests a reset email and shows success", async () => {
    mockAuth.resetPasswordForEmail.mockResolvedValue({ error: null });
    render(
      <MemoryRouter>
        <AuthProvider>
          <ForgotPasswordPage />
        </AuthProvider>
      </MemoryRouter>
    );
    await waitFor(() => screen.getByLabelText(/email/i));
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "a@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    expect(mockAuth.resetPasswordForEmail).toHaveBeenCalledWith("a@example.com", expect.any(Object));
  });

  it("shows an error when the request fails", async () => {
    mockAuth.resetPasswordForEmail.mockResolvedValue({ error: { message: "boom" } });
    render(
      <MemoryRouter>
        <AuthProvider>
          <ForgotPasswordPage />
        </AuthProvider>
      </MemoryRouter>
    );
    await waitFor(() => screen.getByLabelText(/email/i));
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "a@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  });
});

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockAuth.getSession.mockResolvedValue({ data: { session: { user: { id: "user-1", email: "a@example.com" } } }, error: null });
    mockAuth.onAuthStateChange.mockImplementation((cb?: (event: string, session: unknown) => void) => {
      if (cb) cb("PASSWORD_RECOVERY", { user: { id: "user-1", email: "a@example.com" } });
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
  });

  function renderResetPage() {
    return render(
      <MemoryRouter>
        <AuthProvider>
          <ResetPasswordPage />
        </AuthProvider>
      </MemoryRouter>
    );
  }

  it("hides the form while the session is being restored", async () => {
    let resolveSession!: (value: unknown) => void;
    mockAuth.getSession.mockReturnValue(new Promise((resolve) => { resolveSession = resolve; }));
    mockAuth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    renderResetPage();

    expect(screen.queryByLabelText(/new password/i)).toBeNull();
    expect(screen.getByRole("status").textContent).toMatch(/verifying/i);
    expect(screen.queryByRole("alert")).toBeNull();

    await act(async () => resolveSession({ data: { session: null }, error: null }));
    expect(screen.getByRole("alert").textContent).toMatch(/invalid or has expired/i);
  });

  it.each([
    { name: "a normal signed-in session", url: "/reset-password", storedId: null, userId: "user-1" },
    { name: "a recovery hash alone", url: "/reset-password#type=recovery", storedId: null, userId: "user-1" },
    { name: "an access-token hash alone", url: "/reset-password#access_token=unverified", storedId: null, userId: "user-1" },
    { name: "a recovery query alone", url: "/reset-password?type=recovery", storedId: null, userId: "user-1" },
    { name: "an auth code alone", url: "/reset-password?code=unverified", storedId: null, userId: "user-1" },
    { name: "another user's saved recovery", url: "/reset-password", storedId: "user-2", userId: "user-1" },
    { name: "a session without a user ID", url: "/reset-password", storedId: "1", userId: undefined },
    { name: "a session with an empty user ID", url: "/reset-password", storedId: "1", userId: "" },
  ])("rejects $name", async ({ url, storedId, userId }) => {
    window.history.replaceState(null, "", url);
    if (storedId) window.sessionStorage.setItem("soravo:password-recovery-user", storedId);
    mockAuth.getSession.mockResolvedValue({ data: { session: { user: { id: userId } } }, error: null });
    mockAuth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    renderResetPage();

    expect((await screen.findByRole("alert")).textContent).toMatch(/invalid or has expired/i);
    expect(screen.queryByLabelText(/new password/i)).toBeNull();
    expect(mockAuth.updateUser).not.toHaveBeenCalled();
  });

  it("restores recovery for the matching saved user", async () => {
    window.sessionStorage.setItem("soravo:password-recovery-user", "user-1");
    mockAuth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
    renderResetPage();

    expect(await screen.findByLabelText(/new password/i)).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each(["read", "write", "both"])("accepts recovery events when storage %s fails", async (failure) => {
    if (failure !== "write") vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Storage unavailable"); });
    if (failure !== "read") vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Storage unavailable"); });
    mockAuth.updateUser.mockResolvedValue({ error: null });
    renderResetPage();

    fireEvent.change(await screen.findByLabelText(/new password/i), { target: { value: "new-password-123" } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: "new-password-123" } });
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));
    await waitFor(() => expect(mockAuth.updateUser).toHaveBeenCalledWith({ password: "new-password-123" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/password updated/i));
  });

  it.each(["SIGNED_OUT", "SIGNED_IN"])("hides the form after %s changes the recovery session", async (event) => {
    let notifyAuth!: (event: string, session: unknown) => void;
    mockAuth.onAuthStateChange.mockImplementation((cb?: (event: string, session: unknown) => void) => {
      notifyAuth = cb!;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    renderResetPage();
    await screen.findByRole("alert");

    act(() => notifyAuth("PASSWORD_RECOVERY", { user: { id: "user-1" } }));
    expect(screen.getByLabelText(/new password/i)).toBeTruthy();

    act(() => notifyAuth(event, event === "SIGNED_OUT" ? null : { user: { id: "user-2" } }));
    expect(screen.queryByLabelText(/new password/i)).toBeNull();
    expect(screen.getByRole("alert").textContent).toMatch(/invalid or has expired/i);
  });

  it("updates the password when valid", async () => {
    mockAuth.updateUser.mockResolvedValue({ error: null });
    render(
      <MemoryRouter>
        <AuthProvider>
          <ResetPasswordPage />
        </AuthProvider>
      </MemoryRouter>
    );
    fireEvent.change(await screen.findByLabelText(/new password/i), { target: { value: "new-password-123" } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: "new-password-123" } });
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));
    await waitFor(() => expect(mockAuth.updateUser).toHaveBeenCalledWith({ password: "new-password-123" }));
  });

  it("rejects mismatched passwords", async () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <ResetPasswordPage />
        </AuthProvider>
      </MemoryRouter>
    );
    fireEvent.change(await screen.findByLabelText(/new password/i), { target: { value: "new-password-123" } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: "different-123" } });
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));
    await waitFor(() => expect(screen.getByText(/Passwords do not match/i)).toBeTruthy());
    expect(mockAuth.updateUser).not.toHaveBeenCalled();
  });
});