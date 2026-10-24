/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const mockAuth = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("./supabase", () => ({
  supabase: { auth: mockAuth },
  isConfigured: true,
}));

import { AuthProvider, useAuth, ProtectedRoute } from "./auth";

function Consumer() {
  const { user, loading } = useAuth();
  if (loading) return <p>Loading auth</p>;
  return <p>{user ? user.email : "Logged out"}</p>;
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockAuth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  });

  it("keeps loading true while restoring the session", () => {
    mockAuth.getSession.mockResolvedValue(new Promise(() => {}) as never);
    render(
      <MemoryRouter>
        <AuthProvider>
          <Consumer />
        </AuthProvider>
      </MemoryRouter>
    );
    expect(screen.getByText("Loading auth"))!== null;
  });

  it("resolves to the restored user", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: { user: { email: "a@example.com" } } }, error: null });
    render(
      <MemoryRouter>
        <AuthProvider>
          <Consumer />
        </AuthProvider>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText("a@example.com"))!== null);
  });

  it("exposes password recovery helpers", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    mockAuth.resetPasswordForEmail.mockResolvedValue({ error: null });
    mockAuth.updateUser.mockResolvedValue({ error: null });

    let captured: ReturnType<typeof useAuth> | null = null;
    function Probe() {
      captured = useAuth();
      return null;
    }

    render(
      <MemoryRouter>
        <AuthProvider>
          <Probe />
        </AuthProvider>
      </MemoryRouter>
    );

    await waitFor(() => expect(captured).not.toBeNull());
    await captured!.requestPasswordReset("a@example.com");
    expect(mockAuth.resetPasswordForEmail).toHaveBeenCalledWith("a@example.com", expect.objectContaining({ redirectTo: expect.any(String) }));
    const result = await captured!.updatePassword("new-password-123");
    expect(result.error).toBeNull();
    expect(mockAuth.updateUser).toHaveBeenCalledWith({ password: "new-password-123" });
  });
});

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockAuth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  });

  it("shows a loading gate while restoring", () => {
    mockAuth.getSession.mockResolvedValue(new Promise(() => {}) as never);
    render(
      <MemoryRouter initialEntries={["/account"]}>
        <AuthProvider>
          <Routes>
            <Route path="/account" element={<ProtectedRoute><p>Secret</p></ProtectedRoute>} />
            <Route path="/login" element={<p>Login page</p>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );
    expect(screen.getByTestId("auth-loading-gate"))!== null;
  });

  it("redirects unauthenticated users to login", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    render(
      <MemoryRouter initialEntries={["/account"]}>
        <AuthProvider>
          <Routes>
            <Route path="/account" element={<ProtectedRoute><p>Secret</p></ProtectedRoute>} />
            <Route path="/login" element={<p>Login page</p>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText("Login page"))!== null);
  });

  it("renders protected content when authenticated", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: { user: { email: "a@example.com" } } }, error: null });
    render(
      <MemoryRouter initialEntries={["/account"]}>
        <AuthProvider>
          <Routes>
            <Route path="/account" element={<ProtectedRoute><p>Secret</p></ProtectedRoute>} />
            <Route path="/login" element={<p>Login page</p>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );
    await waitFor(() => expect(screen.getByText("Secret"))!== null);
  });
});
