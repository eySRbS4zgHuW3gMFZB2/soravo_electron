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
  const [status, setStatus] = useState<string>("Validating desktop authentication request...");
  const [callbackUrl, setCallbackUrl] = useState<string | null>(null);

  const params = new URLSearchParams(location.search);
  const state = params.get("state")?.trim() ?? "";
  const challenge = params.get("code_challenge")?.trim() ?? "";
  const method = params.get("code_challenge_method")?.trim() ?? "";
  const intent = params.get("intent")?.trim() ?? "signin";

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

  useEffect(() => {
    if (!auth.user || error || issuedRef.current) return;
    issuedRef.current = true;
    (async () => {
      try {
        setStatus("Creating secure desktop handoff...");
        const session = auth.session;
        const { data, error: invokeError } = await supabase.functions.invoke("desktop-auth-handoff", {
          body: {
            action: "issue",
            state,
            code_challenge: challenge,
            code_challenge_method: method,
            intent,
            refresh_token: session?.refresh_token ?? null,
          },
        });
        if (!mountedRef.current) return;
        if (invokeError || !data?.code) {
          issuedRef.current = false;
          setError("Could not create the desktop handoff.");
          return;
        }
        setCallbackUrl(`soravo://auth/callback?code=${encodeURIComponent(data.code)}&state=${encodeURIComponent(state)}`);
        setStatus("Handoff ready. Open Soravo desktop to finish sign-in.");
      } catch {
        if (!mountedRef.current) return;
        issuedRef.current = false;
        setError("Could not create the desktop handoff.");
      }
    })();
  }, [auth.user, error, state, challenge, method, intent, auth.session]);

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold">Desktop authentication</h1>
        <p className="mt-4">{error}</p>
      </div>
    );
  }

  if (!auth.user) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold">Desktop authentication</h1>
        <p className="mt-4">Please sign in with your Soravo account. After signing in, this page will finish the handoff to the desktop application.</p>
        <p className="mt-2 text-sm text-muted">Intent: {intent}</p>
        <div className="mt-4 flex gap-3">
          <a href={`/login?returnTo=${encodeURIComponent(`/auth/desktop${location.search}`)}`} className="text-primary underline">Sign in</a>
          <a href={`/signup?returnTo=${encodeURIComponent(`/auth/desktop${location.search}`)}`} className="text-primary underline">Create account</a>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Desktop authentication</h1>
      <p className="mt-4">{status}</p>
      {callbackUrl && <p className="mt-4"><a href={callbackUrl} className="text-primary underline">Open Soravo</a></p>}
    </div>
  );
}
