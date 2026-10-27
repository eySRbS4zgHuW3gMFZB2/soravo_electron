import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Navigate, useLocation } from "react-router-dom";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isConfigured } from "./supabase";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  passwordRecoveryUserId: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const CONFIG_ERROR =
  "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.";

/** Read URL parameters from the browser location without SSR assumptions. */
function recoveryRedirectUrl(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/reset-password`;
}

/**
 * Provide the current Supabase session and authentication actions to descendants.
 * Restore the initial session, subscribe to changes, and unsubscribe on unmount.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecoveryUserId, setPasswordRecoveryUserId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return window.sessionStorage.getItem("soravo:password-recovery-user");
    } catch {
      return null;
    }
  });

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!error && mounted) setSession(data.session);
      } catch {
        // Preserve the current session if restoration fails.
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === "PASSWORD_RECOVERY" && nextSession?.user?.id) {
        setPasswordRecoveryUserId(nextSession.user.id);
        try {
          window.sessionStorage.setItem("soravo:password-recovery-user", nextSession.user.id);
        } catch {
          // Ignore storage failures.
        }
      }
      if (event === "SIGNED_OUT") {
        setPasswordRecoveryUserId(null);
        try {
          window.sessionStorage.removeItem("soravo:password-recovery-user");
        } catch {
          // Ignore storage failures.
        }
      }
      // Stop the loading gate once Supabase reports any auth state.
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  /** Sign in with email and password, returning configuration or provider errors. */
  const signIn = async (email: string, password: string) => {
    if (!isConfigured) {
      return { error: CONFIG_ERROR };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  /** Create an account with optional display name metadata and return any error. */
  const signUp = async (email: string, password: string, displayName?: string) => {
    if (!isConfigured) {
      return { error: CONFIG_ERROR };
    }
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo:
          typeof window === "undefined" ? undefined : `${window.location.origin}/account`,
      },
    });
    return { error: error?.message ?? null };
  };

  /** Sign out and clear the local session; throw if Supabase rejects the request. */
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setSession(null);
  };

  /** Request a password reset email using Supabase's supported email flow. */
  const requestPasswordReset = async (email: string) => {
    if (!isConfigured) {
      return { error: CONFIG_ERROR };
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: recoveryRedirectUrl(),
    });
    return { error: error?.message ?? null };
  };

  /** Update the signed-in user's password using Supabase's supported API. */
  const updatePassword = async (password: string) => {
    if (!isConfigured) {
      return { error: CONFIG_ERROR };
    }
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error?.message ?? null };
  };

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    loading,
    passwordRecoveryUserId,
    signIn,
    signUp,
    signOut,
    requestPasswordReset,
    updatePassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Read the session and authentication actions from the nearest AuthProvider.
 * @throws If called outside an AuthProvider.
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/**
 * Gate protected content behind authentication while session restoration is pending.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div
        data-testid="auth-loading-gate"
        role="status"
        aria-label="Restoring session"
        className="flex min-h-screen items-center justify-center"
      >
        <span className="text-muted">Loading...</span>
      </div>
    );
  }

  if (!user) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }

  return <>{children}</>;
}

/**
 * Accept only same-origin relative paths for post-auth redirects so that a
 * crafted `returnTo` cannot become an open redirect.
 */
export function sanitizeReturnTo(value: string | null | undefined, fallback = "/account"): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  // Reject empty, non-relative, backslash, control character, and newline payloads.
  if (
    !trimmed.startsWith("/") ||
    /[\\]/.test(trimmed) ||
    /[\u0000-\u001f\u007f]/.test(trimmed)
  ) {
    return fallback;
  }
  try {
    const base = "http://sanitize.invalid";
    const url = new URL(trimmed, base);
    // Reject cross-origin or protocol-relative redirects.
    if (url.origin !== base) return fallback;
    // Reject any path that still contains a backslash after parsing.
    if (url.pathname.includes("\\") || url.search.includes("\\") || url.hash.includes("\\")) {
      return fallback;
    }
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}

/** Alias names retained for callers/tests that expect different conventions. */
