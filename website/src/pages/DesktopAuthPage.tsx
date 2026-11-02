import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";

export function DesktopAuthPage() {
  const auth = useAuth();
  const location = useLocation();
  const issuedRef = useRef(false);
  const mountedRef = useRef(true);
  const [error, setError] = useState<string | null>(null);
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Validating desktop authentication request...");
  const [callbackUrl, setCallbackUrl] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);

  const params = new URLSearchParams(location.search);
  const state = params.get("state")?.trim() ?? "";
  const challenge = params.get("code_challenge")?.trim() ?? "";
  const method = params.get("code_challenge_method")?.trim() ?? "";
  const intent = params.get("intent")?.trim() ?? "signin";

  useEffect(() => {
    if (!params.get("intent")) return;
    if (intent === "signin" || intent === "signup" || intent === "reset") return;
    setError("Missing or invalid desktop authentication parameters.");
  }, [location.search, intent]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!state || !challenge || method !== "S256") {
      setError("Missing or invalid desktop authentication parameters.");
    }
  }, [state, challenge, method]);

  const issueHandoff = async () => {
    if (!auth.user || error || issuedRef.current) return;
    issuedRef.current = true;
    setHandoffError(null);
    setIssuing(true);
    try {
        setStatus("Creating secure desktop handoff...");

        const issueHandoff = () => supabase.functions.invoke("desktop-auth-handoff", {
          body: {
            action: "issue",
            state,
            code_challenge: challenge,
            code_challenge_method: method,
            intent,
          },
        });

        const { data: currentSession, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw new Error("browser_session_unavailable");
        const expiresAt = currentSession.session?.expires_at ?? 0;
        if (!currentSession.session || expiresAt * 1000 - Date.now() < 60_000) {
          const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError || !refreshed.session) throw new Error("browser_session_expired");
        }

        let { data, error: invokeError } = await issueHandoff();
        const status = invokeError?.status ?? invokeError?.context?.status ?? invokeError?.statusCode;
        if (invokeError && status === 401) {
          const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
          if (!refreshError && refreshed.session) {
            const retry = await issueHandoff();
            data = retry.data;
            invokeError = retry.error;
          }
        }
        if (!mountedRef.current) return;
        if (invokeError || !data?.code) {
          issuedRef.current = false;
          setHandoffError("Could not create the desktop handoff. Try again.");
          return;
        }
        setCallbackUrl(`soravo://auth/callback?code=${encodeURIComponent(data.code)}&state=${encodeURIComponent(state)}`);
        setStatus("Handoff ready. Select Open Soravo to finish sign-in in the desktop app.");
    } catch {
        if (!mountedRef.current) return;
        issuedRef.current = false;
        setHandoffError("Could not create the desktop handoff. Try again.");
    } finally {
      if (mountedRef.current) setIssuing(false);
    }
  };

  if (auth.loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold">Desktop authentication</h1>
        <p className="mt-4">Loading your browser session...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold">Desktop authentication</h1>
        <p className="mt-4">{error}</p>
      </div>
    );
  }

  if (!auth.user) {
    const desktopReturn = `/auth/desktop${location.search}`;
    if (intent === "reset") {
      return (
        <div className="p-8">
          <h1 className="text-2xl font-bold">Reset your password</h1>
          <p className="mt-4">We will send a recovery link to your email. Soravo will finish signing in after you set a new password.</p>
          <p className="mt-4"><a href={`/forgot-password?returnTo=${encodeURIComponent(desktopReturn)}`} className="text-primary underline">Send password reset link</a></p>
        </div>
      );
    }
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold">Desktop authentication</h1>
        <p className="mt-4">Please sign in with your Soravo account. After signing in, confirm the desktop handoff to finish signing in to Soravo.</p>
        <p className="mt-2 text-sm text-muted">Intent: {intent}</p>
        <div className="mt-4 flex gap-3">
          <a href={`/login?returnTo=${encodeURIComponent(desktopReturn)}`} className="text-primary underline">Sign in</a>
          <a href={`/signup?returnTo=${encodeURIComponent(desktopReturn)}`} className="text-primary underline">Create account</a>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Desktop authentication</h1>
      {callbackUrl ? (
        <p className="mt-4">{status}</p>
      ) : (
        <>
          <p className="mt-4">You’re signed in as <strong>{auth.user?.email ?? "your account"}</strong>. Continue to Soravo to finish signing in on your desktop.</p>
          <p className="mt-2 text-sm text-muted">Continue only if you started sign-in from the Soravo app on this device. Never share the Open Soravo link.</p>
        </>
      )}
      {handoffError && <p role="alert" className="mt-4 text-sm text-red-600">{handoffError}</p>}
      {!callbackUrl && (
        <button type="button" className="mt-4 rounded-full bg-ink px-5 py-3 font-semibold text-lime disabled:opacity-50" disabled={issuing} onClick={() => void issueHandoff()}>
          {issuing ? "Preparing secure handoff…" : "Continue to Soravo"}
        </button>
      )}
      {callbackUrl && <p className="mt-4"><a href={callbackUrl} className="text-primary underline">Open Soravo</a></p>}
    </div>
  );
}
