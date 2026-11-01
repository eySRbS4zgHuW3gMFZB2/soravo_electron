import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { consumeAuthReturnTo, readAuthReturnTo, useAuth } from "../lib/auth";

/** Complete a fixed-URL email confirmation and restore the local auth destination. */
export function AuthConfirmationPage() {
  const { loading, user } = useAuth();
  const navigate = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    if (loading || handled.current) return;
    handled.current = true;

    if (!user) {
      const returnTo = readAuthReturnTo();
      const loginUrl = returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : "/login";
      navigate(loginUrl, { replace: true });
      return;
    }

    navigate(consumeAuthReturnTo() ?? "/account", { replace: true });
  }, [loading, user, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <p role="status" className="text-sm text-muted">Confirming your Soravo account…</p>
    </div>
  );
}
