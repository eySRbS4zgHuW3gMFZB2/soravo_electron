import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";

/** Update the recovery password with clear loading/success/error states. */
export function ResetPasswordPage() {
  const { updatePassword, session, loading: authLoading, passwordRecoveryUserId } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState<boolean | null>(null);
  const [isRecovery, setIsRecovery] = useState(() => {
    if (typeof window === "undefined") return false;
    const hash = window.location.hash || "";
    const search = window.location.search || "";
    if (
      hash.includes("type=recovery") ||
      hash.includes("access_token") ||
      search.includes("type=recovery") ||
      search.includes("code=")
    ) {
      return true;
    }
    try {
      return Boolean(window.sessionStorage.getItem("soravo:password-recovery-user"));
    } catch {
      return false;
    }
  });

  // A recovery link establishes a session and emits PASSWORD_RECOVERY. Without
  // that recovery state, a normal signed-in session is not a valid reset flow.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
        try {
          window.sessionStorage.setItem(
            "soravo:password-recovery-user",
            nextSession?.user?.id ?? "1"
          );
        } catch {
          // Ignore storage failures; URL/session state still drives the flow.
        }
      }
      if (event === "SIGNED_OUT") {
        setIsRecovery(false);
        try {
          window.sessionStorage.removeItem("soravo:password-recovery-user");
        } catch {
          // Ignore storage failures.
        }
      }
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;
    let storedUserId: string | null = null;
    try {
      storedUserId = window.sessionStorage.getItem("soravo:password-recovery-user");
    } catch {
      storedUserId = null;
    }
    const sameUser = session?.user
      ? session.user.id
        ? storedUserId === session.user.id
        : Boolean(storedUserId)
      : false;
    if (storedUserId && !sameUser) {
      try {
        window.sessionStorage.removeItem("soravo:password-recovery-user");
      } catch {
        // Ignore storage failures.
      }
      setIsRecovery(false);
      setRecoveryReady(false);
      return;
    }
    if (!session?.user) {
      try {
        window.sessionStorage.removeItem("soravo:password-recovery-user");
      } catch {
        // Ignore storage failures.
      }
    }
    setRecoveryReady(sameUser && isRecovery);
  }, [authLoading, session, isRecovery]);

  const verifiedRecovery = session?.user
    ? session.user.id
      ? passwordRecoveryUserId === session.user.id
      : Boolean(passwordRecoveryUserId)
    : false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (authLoading || !verifiedRecovery) {
      setError("This recovery link is invalid or has expired.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await updatePassword(password);
      if (error) {
        setError(error);
      } else {
        try {
          window.sessionStorage.removeItem("soravo:password-recovery-user");
        } catch {
          // Ignore storage failures.
        }
        setSuccess(true);
        setTimeout(() => navigate("/login"), 1500);
      }
    } catch {
      setError("Unable to update the password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-ink">Choose a new password</h1>
        <p className="mt-2 text-sm text-muted">
          Your recovery link must still be valid to complete this update.
        </p>

        {success ? (
          <div role="status" className="mt-8 rounded-lg bg-green-50 p-4 text-sm text-green-700">
            Password updated. Redirecting to login...
          </div>
        ) : authLoading ? (
          <div role="status" className="mt-8 text-muted">Loading...</div>
        ) : !verifiedRecovery ? (
          <div role="alert" className="mt-8 rounded-lg bg-red-50 p-4 text-sm text-red-600">
            This recovery link is invalid or has expired. Request a new password reset link.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {error && (
              <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-ink">
                New password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2 text-ink"
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-ink">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2 text-ink"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-ink py-3 font-semibold text-lime disabled:opacity-50"
            >
              {loading ? "Updating..." : "Update password"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-muted">
          <Link to="/login" className="underline">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}