import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import {
  fetchAdminAudit,
  fetchAdminDevices,
  fetchAdminOverview,
  fetchAdminPayments,
  fetchAdminSubscriptions,
  fetchAdminUsers,
} from "../lib/api";

type Section = "overview" | "users" | "payments" | "subscriptions" | "devices" | "audit";

const SECTIONS: Section[] = ["overview", "users", "payments", "subscriptions", "devices", "audit"];

function deniedMessage(error: string | null): string {
  if (!error || error === "Admin access denied") return "Admin access denied.";
  return error;
}

export function AdminPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [section, setSection] = useState<Section>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<any>(null);
  const [usersPage, setUsersPage] = useState(1);
  const [usersQuery, setUsersQuery] = useState("");
  const [usersData, setUsersData] = useState<any>(null);
  const [usersLoading, setUsersLoading] = useState(false);
  const [paymentsData, setPaymentsData] = useState<any>(null);
  const [subscriptionsData, setSubscriptionsData] = useState<any>(null);
  const [devicesData, setDevicesData] = useState<any>(null);
  const [auditData, setAuditData] = useState<any>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchAdminOverview();
        if (!cancelled) setOverview(data);
      } catch (e) {
        if (!cancelled) setError(deniedMessage(e instanceof Error ? e.message : null));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [authLoading, user]);

  useEffect(() => {
    if (authLoading || !user || error) return;
    let cancelled = false;
    (async () => {
      try {
        if (section === "users") {
          setUsersLoading(true);
          const data = await fetchAdminUsers(usersPage, 25, usersQuery);
          if (!cancelled) setUsersData(data);
        } else if (section === "payments") {
          const data = await fetchAdminPayments(1, 25);
          if (!cancelled) setPaymentsData(data);
        } else if (section === "subscriptions") {
          const data = await fetchAdminSubscriptions();
          if (!cancelled) setSubscriptionsData(data);
        } else if (section === "devices") {
          const data = await fetchAdminDevices();
          if (!cancelled) setDevicesData(data);
        } else if (section === "audit") {
          const data = await fetchAdminAudit(1, 25);
          if (!cancelled) setAuditData(data);
        }
      } catch (e) {
        if (!cancelled) setError(deniedMessage(e instanceof Error ? e.message : null));
      } finally {
        if (!cancelled) setUsersLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [section, authLoading, user, usersPage, usersQuery, error]);

  if (authLoading) return <p className="p-8 text-muted">Loading...</p>;
  if (!user) return <p className="p-8 text-muted">Please log in.</p>;
  if (loading) return <p className="p-8 text-muted">Verifying admin access...</p>;
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-ink">Admin access denied</h1>
          <p className="mt-3 text-muted">{error}</p>
          <Link to="/account" className="mt-6 inline-block rounded-full bg-ink px-6 py-3 font-semibold text-lime">
            Back to account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-ink/10 px-6 py-4">
        <nav className="mx-auto flex max-w-7xl items-center justify-between">
          <Link to="/" className="text-xl font-bold text-ink">Soravo Admin</Link>
          <button onClick={() => void signOut()} className="text-sm text-muted hover:underline">
            Sign out
          </button>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <h1 className="text-2xl font-bold text-ink">Administrator dashboard</h1>
        <div className="mt-4 flex flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSection(s)}
              className={`rounded-full px-4 py-1 text-sm capitalize ${section === s ? "bg-ink text-lime" : "border border-ink/20 text-ink"}`}
            >
              {s}
            </button>
          ))}
        </div>

        {section === "overview" && overview && (
          <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card label="Registered users" value={overview.totalUsers} />
            <Card label="New users (30 days)" value={overview.newUsers30d} />
            <Card label="Active devices" value={overview.activeDevices} />
            <Card label="Lifetime entitlements" value={overview.lifetimeEntitlements} />
            <Card label="Monthly entitlements" value={overview.monthlyEntitlements} />
            <Card label="Captured payments" value={overview.capturedPayments} />
            <Card label="Payment total (minor units)" value={overview.paymentTotalMinor} />
            <Card label="Failed payments" value={overview.failedPayments} />
          </section>
        )}
        {section === "overview" && overview && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-ink">New users by day (14 days)</h2>
            <ul className="mt-3 space-y-1 text-sm text-muted">
              {overview.newUsersByDay?.map((row: any) => (
                <li key={row.date}>{row.date}: {row.count}</li>
              ))}
            </ul>
            <h2 className="mt-6 text-lg font-semibold text-ink">Subscription status breakdown</h2>
            <ul className="mt-3 space-y-1 text-sm text-muted">
              {Object.entries(overview.subscriptionBreakdown ?? {}).map(([status, count]) => (
                <li key={status}>{status}: {String(count)}</li>
              ))}
            </ul>
            <h2 className="mt-6 text-lg font-semibold text-ink">Webhook processing status</h2>
            <ul className="mt-3 space-y-1 text-sm text-muted">
              {Object.entries(overview.webhookBreakdown ?? {}).map(([status, count]) => (
                <li key={status}>{status}: {String(count)}</li>
              ))}
            </ul>
          </section>
        )}

        {section === "users" && (
          <section className="mt-8">
            <div className="flex gap-2">
              <input
                className="rounded border border-ink/20 px-3 py-1"
                placeholder="Search email or name"
                value={usersQuery}
                onChange={(e) => setUsersQuery(e.target.value)}
              />
              <button
                type="button"
                onClick={() => void fetchAdminUsers(usersPage, 25, usersQuery).then(setUsersData).catch(() => {})}
                className="rounded bg-ink px-3 py-1 text-sm text-lime"
              >
                Search
              </button>
            </div>
            {usersLoading && <p className="mt-4 text-muted">Loading users...</p>}
            <ul className="mt-4 space-y-2">
              {usersData?.users?.map((u: any) => (
                <li key={u.userId} className="rounded border border-ink/10 p-3 text-sm">
                  <p className="font-semibold text-ink">{u.email || u.displayName || u.userId}</p>
                  <p className="text-muted">ID: {u.userId} · Signup: {u.signupDate ? new Date(u.signupDate).toLocaleDateString() : "n/a"}</p>
                  <p className="text-muted">Entitlements: {u.entitlements?.map((e: any) => `${e.plan_code}/${e.status}`).join(", ") || "none"}</p>
                  <p className="text-muted">Devices (active/total): {u.devices?.active ?? 0}/{u.devices?.total ?? 0} · Payments: {u.payments?.total ?? 0}</p>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                className="rounded border border-ink/20 px-3 py-1 text-sm"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setUsersPage((p) => p + 1)}
                className="rounded border border-ink/20 px-3 py-1 text-sm"
              >
                Next
              </button>
            </div>
          </section>
        )}

        {section === "payments" && paymentsData && (
          <section className="mt-8 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="p-2">Created</th>
                  <th className="p-2">User</th>
                  <th className="p-2">Amount</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Payment ID</th>
                </tr>
              </thead>
              <tbody>
                {paymentsData.payments?.map((p: any) => (
                  <tr key={p.id} className="border-t border-ink/10">
                    <td className="p-2">{new Date(p.created_at).toLocaleString()}</td>
                    <td className="p-2">{p.userEmail || p.user_id}</td>
                    <td className="p-2">{p.amount_minor} {p.currency}</td>
                    <td className="p-2">{p.status}</td>
                    <td className="p-2">{p.provider_payment_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {section === "subscriptions" && subscriptionsData && (
          <section className="mt-8">
            <ul className="space-y-2 text-sm">
              {subscriptionsData.subscriptions?.map((s: any) => (
                <li key={s.id} className="rounded border border-ink/10 p-3">
                  {s.userEmail || s.user_id} · {s.status} · period end {s.current_period_end ? new Date(s.current_period_end).toLocaleDateString() : "n/a"}
                </li>
              ))}
            </ul>
          </section>
        )}

        {section === "devices" && devicesData && (
          <section className="mt-8">
            <ul className="space-y-2 text-sm">
              {devicesData.devices?.map((d: any) => (
                <li key={d.id} className="rounded border border-ink/10 p-3">
                  {d.userEmail || d.user_id} · {d.label || d.device_id} · {d.platform || "unknown"} · last seen {new Date(d.last_seen_at).toLocaleString()} · {d.revoked_at ? "revoked" : "active"}
                </li>
              ))}
            </ul>
          </section>
        )}

        {section === "audit" && auditData && (
          <section className="mt-8">
            <ul className="space-y-2 text-sm">
              {auditData.events?.map((e: any) => (
                <li key={e.id} className="rounded border border-ink/10 p-3">
                  {new Date(e.created_at).toLocaleString()} · {e.actorEmail || e.actor_user_id} · {e.action} · target {e.target_type}/{e.target_id}
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}

function Card({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-lg border border-ink/10 p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold text-ink">{String(value)}</p>
    </div>
  );
}
