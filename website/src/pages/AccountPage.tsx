import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { listEntitlements } from "../lib/api";

/**
 * Show the signed-in user's email and entitlements, with sign-out access.
 * Prompt signed-out visitors to log in and ignore stale entitlement responses.
 */
export function AccountPage() {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [entitlements, setEntitlements] = useState<
    { plan_code: string; status: string; lifetime: boolean }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);

  const refreshEntitlements = async () => {
    if (!user) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await listEntitlements();
      setEntitlements(data);
    } catch {
      setLoadError("Could not load entitlements. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setSignOutError(null);
    try {
      await signOut();
      navigate("/", { replace: true });
    } catch {
      setSignOutError("Sign-out failed. Please try again.");
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setEntitlements([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await listEntitlements();
        if (!cancelled) setEntitlements(data);
      } catch {
        if (!cancelled) setLoadError("Could not load entitlements. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  // After a browser checkout callback, refresh a few times because webhook
  // provisioning is authoritative and may lag behind the redirect.
  useEffect(() => {
    if (authLoading || !user || searchParams.get("checkout") !== "1") return;
    setCheckoutNotice("Payment submitted. Entitlements update after server confirmation.");
    const attempts = [0, 1500, 3000];
    const timers = attempts.map((delay) =>
      window.setTimeout(() => void refreshEntitlements(), delay)
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [authLoading, user, searchParams]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <p className="text-muted">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-ink">Account</h1>
          <p className="mt-4 text-muted">Please log in to view your account.</p>
          <Link to="/login" className="mt-6 inline-block rounded-full bg-ink px-6 py-3 font-semibold text-lime">
            Log in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-ink/10 px-6 py-4">
        <nav className="mx-auto flex max-w-6xl items-center justify-between">
          <Link to="/" className="text-xl font-bold text-ink">Soravo</Link>
          <button onClick={handleSignOut} className="text-sm text-muted hover:underline">
            Sign out
          </button>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="text-3xl font-bold text-ink">Account</h1>
        <p className="mt-2 text-muted">{user.email}</p>
        {signOutError && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{signOutError}</p>
        )}
        {checkoutNotice && (
          <p role="status" className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
            {checkoutNotice}
          </p>
        )}

        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-ink">Entitlements</h2>
            <button
              type="button"
              onClick={() => void refreshEntitlements()}
              className="text-sm text-muted hover:underline"
            >
              Refresh
            </button>
          </div>
          {loading ? (
            <p className="mt-4 text-muted">Loading...</p>
          ) : loadError ? (
            <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{loadError}</p>
          ) : entitlements.length === 0 ? (
            <p className="mt-4 text-muted">No active entitlements. Choose a plan to get started.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {entitlements.map((e, i) => (
                <li key={i} className="rounded-lg border border-ink/10 p-4">
                  <span className="font-semibold text-ink">{e.plan_code}</span>
                  <span className="ml-2 text-sm text-muted">— {e.status}</span>
                  {e.lifetime && <span className="ml-2 text-xs text-lime">Lifetime</span>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-ink">Devices</h2>
          <p className="mt-2 text-sm text-muted">
            Devices are registered automatically when you sign in from the Soravo desktop app.
            Monthly plans allow up to 3 active devices. Lifetime plans have no limit.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-ink">Desktop App</h2>
          <p className="mt-2 text-sm text-muted">
            Download the Soravo desktop app from the releases page. After
            installing, sign in with your account to activate your entitlement.
          </p>
        </section>
      </main>
    </div>
  );
}