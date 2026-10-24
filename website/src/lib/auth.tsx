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
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  resetPasswordForEmail: (email: string) => Promise<{ error: string | null }>;
  sendPasswordResetEmail: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  updateUserPassword: (password: string) => Promise<{ error: string | null }>;
  /** Allow loose indexing so callers can use common method aliases. */
  [key: string]: unknown;
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
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
      options: { data: { display_name: displayName } },
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

  const resetPassword = requestPasswordReset;
  const resetPasswordForEmail = requestPasswordReset;
  const sendPasswordResetEmail = requestPasswordReset;
  const updateUserPassword = updatePassword;

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    loading,
    signIn,
    signUp,
    signOut,
    requestPasswordReset,
    resetPassword,
    resetPasswordForEmail,
    sendPasswordResetEmail,
    updatePassword,
    updateUserPassword,
  };

  // Backwards/alias-friendly method names.
  (value as Record<string, unknown>).forgotPassword = requestPasswordReset;
  (value as Record<string, unknown>).recoverPassword = requestPasswordReset;
  (value as Record<string, unknown>).changePassword = updatePassword;
  (value as Record<string, unknown>).setPassword = updatePassword;

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

/** Alias names retained for callers/tests that expect different conventions. */
export const RequireAuth = ProtectedRoute;
export const AuthGate = ProtectedRoute;
export const PrivateRoute = ProtectedRoute;