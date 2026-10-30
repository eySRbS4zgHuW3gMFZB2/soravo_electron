/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const mockAuth = vi.hoisted(() => ({
  getSession: vi.fn(),
  initialize: vi.fn().mockResolvedValue({}),
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

import { AuthProvider, useAuth, ProtectedRoute, sanitizeReturnTo } from "./auth";
import { LoginPage } from "../pages/LoginPage";

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

describe("auth callback feedback", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockAuth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  });

  afterEach(() => {
    cleanup();
    window.history.replaceState(null, "", "/");
  });

  it.each([
    ["type=signup&access_token=synthetic&refresh_token=synthetic", "verified"],
    ["type=signup&access_token=synthetic&refresh_token=synthetic&error=access_denied", "failed"],
    ["type=signup", "idle"],
    ["type=signup&access_token=synthetic", "idle"],
    ["type=signup&refresh_token=synthetic", "idle"],
    ["type=recovery&access_token=synthetic&refresh_token=synthetic", "idle"],
    ["type=magiclink&access_token=synthetic&refresh_token=synthetic", "idle"],
    ["type=invite&access_token=synthetic&refresh_token=synthetic", "idle"],
    ["type=email_change&access_token=synthetic&refresh_token=synthetic", "idle"],
    ["access_token=synthetic&refresh_token=synthetic", "idle"],
  ])("classifies callback %s as %s at each restoration stage", async (params, expected) => {
    window.history.replaceState(null, "", `/account#${params}`);
    let resolveInitialization!: (value: unknown) => void;
    let resolveSession!: (value: unknown) => void;
    mockAuth.initialize.mockReturnValue(new Promise((resolve) => { resolveInitialization = resolve; }));
    mockAuth.getSession.mockReturnValue(new Promise((resolve) => { resolveSession = resolve; }));
    function ConfirmationStatus() {
      return <p role="status">{useAuth().emailConfirmationStatus}</p>;
    }
    render(<AuthProvider><ConfirmationStatus /></AuthProvider>);

    expect(screen.getByRole("status").textContent).toBe(expected === "failed" ? "failed" : "idle");
    await act(async () => resolveInitialization({ error: null }));
    expect(mockAuth.getSession).toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toBe(expected);
    await act(async () => resolveSession({ data: { session: { user: { id: "user-1" } } }, error: null }));
    expect(screen.getByRole("status").textContent).toBe(expected);
  });

  it.each(["returned", "thrown"])("keeps signup confirmation idle after a %s initialization error", async (failure) => {
    window.history.replaceState(null, "", "/account#type=signup&access_token=synthetic&refresh_token=synthetic");
    const error = new Error("expired synthetic-private-value");
    if (failure === "returned") {
      mockAuth.initialize.mockResolvedValue({ error });
    } else {
      mockAuth.initialize.mockRejectedValue(error);
    }
    let resolveSession!: (value: unknown) => void;
    mockAuth.getSession.mockReturnValue(new Promise((resolve) => { resolveSession = resolve; }));
    function CallbackFeedback() {
      const { emailConfirmationStatus, authError, user } = useAuth();
      return <>
        <p role="status">{emailConfirmationStatus}</p>
        {authError && <p role="alert">{authError}</p>}
        {user && <p>{user.email}</p>}
      </>;
    }
    render(<AuthProvider><CallbackFeedback /></AuthProvider>);

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("idle");
    if (failure === "returned") {
      expect(mockAuth.getSession).toHaveBeenCalled();
      await act(async () => resolveSession({ data: { session: { user: { id: "existing-user", email: "existing@example.com" } } }, error: null }));
      expect(screen.getByText("existing@example.com")).toBeTruthy();
      expect(screen.getByRole("status").textContent).toBe("idle");
      expect(screen.getByRole("alert")).toBeTruthy();
    } else {
      expect(mockAuth.getSession).not.toHaveBeenCalled();
    }
    expect(document.body.textContent).not.toContain("synthetic-private-value");
  });

  it("preserves a failed link during expired session restoration and clears it on later sign-out", async () => {
    window.history.replaceState(null, "", "/account#error=access_denied&error_description=expired%20synthetic-private-value&type=signup");
    mockAuth.initialize.mockResolvedValue({ error: { message: "expired synthetic-private-value" } });
    const emitSignOut = () => {
      const [notify] = mockAuth.onAuthStateChange.mock.calls[0] as unknown as [(event: string, session: null) => void];
      notify("SIGNED_OUT", null);
    };
    mockAuth.getSession.mockImplementation(async () => {
      emitSignOut();
      return { data: { session: null }, error: { message: "invalid refresh token" } };
    });
    function ConfirmationStatus() {
      return <p role="status">{useAuth().emailConfirmationStatus}</p>;
    }
    render(
      <MemoryRouter initialEntries={["/account"]}>
        <AuthProvider>
          <ConfirmationStatus />
          <Routes>
            <Route path="/account" element={<ProtectedRoute><p>Secret</p></ProtectedRoute>} />
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Log in" })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe("This link has expired. Request a new one and try again.");
    expect(screen.getByRole("status").textContent).toBe("failed");
    expect(document.body.textContent).not.toContain("synthetic-private-value");
    await act(async () => emitSignOut());
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("idle");
  });

  it("shows sanitized callback errors on login after the protected account redirects", async () => {
    window.history.replaceState(null, "", "/account#error=access_denied&error_description=expired%20synthetic-private-value&type=signup");
    mockAuth.initialize.mockResolvedValue({ error: { message: "expired synthetic-private-value" } });
    mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    render(
      <MemoryRouter initialEntries={["/account"]}>
        <AuthProvider>
          <Routes>
            <Route path="/account" element={<ProtectedRoute><p>Secret</p></ProtectedRoute>} />
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Log in" })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe("This link has expired. Request a new one and try again.");
    expect(screen.queryByText("Secret")).toBeNull();
    expect(document.body.textContent).not.toContain("synthetic-private-value");
    expect(window.location.hash).toBe("");
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

describe("sanitizeReturnTo", () => {
  it("accepts a safe relative path", () => {
    expect(sanitizeReturnTo("/account?tab=devices")).toBe("/account?tab=devices");
  });

  it("rejects cross-origin absolute URLs", () => {
    expect(sanitizeReturnTo("https://evil.example/phish")).toBe("/account");
  });

  it("rejects protocol-relative URLs", () => {
    expect(sanitizeReturnTo("//evil.example/phish")).toBe("/account");
  });

  it("rejects backslashes", () => {
    expect(sanitizeReturnTo("/foo\\bar")).toBe("/account");
  });

  it("rejects control characters", () => {
    expect(sanitizeReturnTo("/foo\u0001bar")).toBe("/account");
  });

  it("falls back for empty input", () => {
    expect(sanitizeReturnTo(null)).toBe("/account");
    expect(sanitizeReturnTo("")).toBe("/account");
  });
});
