import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";

export function DesktopAuthPage() {
  const auth = useAuth();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Validating desktop authentication request...");
  const params = new URLSearchParams(location.search);
  const state = params.get("state")?.trim() ?? "";
  const challenge = params.get("code_challenge")?.trim() ?? "";
  const method = params.get("code_challenge_method")?.trim() ?? "";
  const intent = params.get("intent")?.trim() ?? "signin";

  useEffect(() => {
    if (!state || !challenge || method !== "S256") {
      setError("Missing or invalid desktop authentication parameters.");
      return;
    }
  }, [state, challenge, method]);

  useEffect(() => {
    if (!auth.user || error) return;
    (async () => {
      setStatus("Creating secure desktop handoff...");
      const { data, error: invokeError } = await supabase.functions.invoke("desktop-auth-handoff", {
        body: {
          action: "issue",
          state,
          code_challenge: challenge,
          code_challenge_method: method,
          intent,
        },
      });
      if (invokeError || !data?.code) {
        setError("Could not create the desktop handoff.");
        return;
      }
      window.location.href = `soravo://auth/callback?code=${encodeURIComponent(data.code)}&state=${encodeURIComponent(state)}`;
      setStatus("Returning to Soravo desktop...");
    })();
  }, [auth.user, error, state, challenge, method, intent]);

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
        {/* Reuse explicit login/signup links rather than duplicating forms. */}
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
    </div>
  );
}
