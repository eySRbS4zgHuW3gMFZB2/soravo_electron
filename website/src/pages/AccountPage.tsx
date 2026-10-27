import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { listEntitlements, listDevices, revokeDevice } from "../lib/api";

/**
 * Show the signed-in user's email and entitlements, with sign-out access.
 * Prompt signed-out visitors to log in and ignore stale entitlement responses.
 */
export function AccountPage() {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [entitlements, setEntitlements] = useState<
    { plan_code: string; status: string; lifetime: boolean; subscription_period_end: string | null }[]
  >([]);
  const [devices, setDevices] = useState<
    { id: string; device_id: string; label: string | null; platform: string | null; last_seen_at: string }[]
  >([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [devicesError, setDevicesError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);
  const effectiveStatus = (entitlement: { status: string; lifetime: boolean; subscription_period_end: string | null }) =>
    !entitlement.lifetime && entitlement.status === "active" && entitlement.subscription_period_end &&
    new Date(entitlement.subscription_period_end).getTime() <= Date.now()
      ? "expired"
      : entitlement.status;
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

  const refreshDevices = async () => {
    if (!user) return;
    setDevicesLoading(true);
    setDevicesError(null);
    try {
      const data = await listDevices();
      setDevices(data);
    } catch {
      setDevicesError("Could not load devices. Please try again.");
    } finally {
      setDevicesLoading(false);
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    setRevoking(deviceId);
    try {
      await revokeDevice(deviceId);
      await refreshDevices();
    } catch {
      setDevicesError("Could not revoke the device. Please try again.");
    } finally {
      setRevoking(null);
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
      setDevices([]);
      setDevicesLoading(false);
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

      setDevicesLoading(true);
      setDevicesError(null);
      try {
        const deviceData = await listDevices();
        if (!cancelled) setDevices(deviceData);
      } catch {
        if (!cancelled) setDevicesError("Could not load devices. Please try again.");
      } finally {
        if (!cancelled) setDevicesLoading(false);
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
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-ink capitalize">{e.plan_code}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${e.lifetime ? "bg-lime text-ink" : "bg-ink/10 text-ink"}`}>
                      {e.lifetime ? "Lifetime" : effectiveStatus(e)}
                    </span>
                  </div>
                  <dl className="mt-3 space-y-1 text-sm text-muted">
                    <div className="flex gap-2">
                      <dt className="font-medium text-ink">Status:</dt>
                      <dd>{effectiveStatus(e)}</dd>
                    </div>
                    {!e.lifetime && e.subscription_period_end && (
                      <div className="flex gap-2">
                        <dt className="font-medium text-ink">Period ends:</dt>
                        <dd>{new Date(e.subscription_period_end).toLocaleDateString()}</dd>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <dt className="font-medium text-ink">Usage:</dt>
                      <dd>{e.lifetime ? "Unlimited devices, indefinite offline use" : "Up to 3 active devices, 14-day offline grace"}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-ink">Devices</h2>
            <button type="button" onClick={() => void refreshDevices()} className="text-sm text-muted hover:underline">
              Refresh
            </button>
          </div>
          <p className="mt-2 text-sm text-muted">
            Devices are registered automatically when you sign in from the Soravo desktop app.
            Monthly plans allow up to 3 active devices. Lifetime plans have no limit.
          </p>
          {devicesError && (
            <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{devicesError}</p>
          )}
          {devicesLoading ? (
            <p className="mt-4 text-muted">Loading devices...</p>
          ) : devices.length === 0 ? (
            <p className="mt-4 text-muted">No active devices registered.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {devices.map((device) => (
                <li key={device.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ink/10 p-4">
                  <div>
                    <p className="font-semibold text-ink">{device.label || device.device_id}</p>
                    <p className="text-sm text-muted">
                      {device.platform || "Unknown platform"} · Last seen {new Date(device.last_seen_at).toLocaleString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={revoking === device.device_id}
                    onClick={() => void handleRevokeDevice(device.device_id)}
                    className="rounded-full border border-ink/20 px-3 py-1 text-sm text-ink disabled:opacity-50"
                  >
                    {revoking === device.device_id ? "Revoking..." : "Revoke"}
                  </button>
                </li>
              ))}
            </ul>
          )}
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