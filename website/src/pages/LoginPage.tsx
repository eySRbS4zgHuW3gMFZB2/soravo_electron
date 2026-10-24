import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

/** Render the email/password login form and navigate to the account on success. */
export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /** Submit the login form, display failures, and reset the pending state. */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        setError(error);
      } else {
        navigate("/account");
      }
    } catch {
      setError("Unable to log in. Please try again.");
    } finally {
      // Always reset loading, whether signIn resolved or rejected.
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-ink">Log in</h1>
        <p className="mt-2 text-sm text-muted">
          Don&apos;t have an account? <Link to="/signup" className="underline">Sign up</Link>
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-ink">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2 text-ink"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-ink">Password</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2 text-ink"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-ink py-3 font-semibold text-lime disabled:opacity-50"
          >
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>
      </div>
    </div>
  );
}