import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { useEffect, useState } from "react";

export function AccountPage() {
  const { user, signOut } = useAuth();
  const [entitlements, setEntitlements] = useState<
    { plan_code: string; status: string; lifetime: boolean }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("entitlements")
        .select("plan_code, status, lifetime")
        .eq("user_id", user.id);
      setEntitlements(data ?? []);
      setLoading(false);
    })();
  }, [user]);

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
          <button onClick={signOut} className="text-sm text-muted hover:underline">
            Sign out
          </button>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="text-3xl font-bold text-ink">Account</h1>
        <p className="mt-2 text-muted">{user.email}</p>

        <section className="mt-8">
          <h2 className="text-xl font-semibold text-ink">Entitlements</h2>
          {loading ? (
            <p className="mt-4 text-muted">Loading...</p>
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
            Device management will be available in a future update.
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