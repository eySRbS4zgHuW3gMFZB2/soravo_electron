/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mockAuth = vi.hoisted(() => ({
  getSession: vi.fn(),
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

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    mockAuth.onAuthStateChange.mockImplementation((cb?: (event: string, session: unknown) => void) => {
      if (cb) cb("PASSWORD_RECOVERY", { user: { email: "a@example.com" } });
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
    mockAuth.getSession.mockResolvedValue({ data: { session: { user: { email: "a@example.com" } } }, error: null });
    mockAuth.onAuthStateChange.mockImplementation((cb?: (event: string, session: unknown) => void) => {
      if (cb) cb("PASSWORD_RECOVERY", { user: { email: "a@example.com" } });
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
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
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: "new-password-123" } });
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
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: "new-password-123" } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: "different-123" } });
    fireEvent.click(screen.getByRole("button", { name: /update password/i }));
    await waitFor(() => expect(screen.getByText(/Passwords do not match/i)).toBeTruthy());
    expect(mockAuth.updateUser).not.toHaveBeenCalled();
  });
});