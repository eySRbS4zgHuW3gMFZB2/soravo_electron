import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth";

/**
 * Render signup with the plan query parameter and a confirmation message on success.
 * The selected plan is displayed here; signup only creates an account.
 */
export function SignupPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const plan = searchParams.get("plan") || "monthly";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  /** Submit account details, display the result, and reset the pending state. */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error } = await signUp(email, password, displayName);
      if (error) {
        setError(error);
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Unable to create the account. Please try again.");
    } finally {
      // Always reset loading, whether signUp resolved or rejected.
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <h1 className="text-3xl font-bold text-ink">Check your email</h1>
          <p className="mt-4 text-muted">
            We sent a confirmation link to <strong>{email}</strong>. Click it to create
            your account.
          </p>
          <Link to="/login" className="mt-6 inline-block text-ink underline">
            Back to login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-ink">Create account</h1>
        <p className="mt-2 text-sm text-muted">
          Selected plan: <strong>{plan}</strong>.{" "}
          <Link to="/pricing" className="underline">Change plan</Link>
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-ink">Display name</label>
            <input
              id="name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2 text-ink"
            />
          </div>
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
              minLength={8}
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
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          Already have an account? <Link to="/login" className="underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}
