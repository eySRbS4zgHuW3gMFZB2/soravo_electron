import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";

/** Request a Supabase password-reset email with clear loading and result states. */
export function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const { error } = await requestPasswordReset(email);
      if (error) {
        setError(error);
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Unable to send the reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-ink">Reset password</h1>
        <p className="mt-2 text-sm text-muted">
          Enter your account email and we will send a recovery link.
        </p>

        {success ? (
          <div role="status" className="mt-8 rounded-lg bg-green-50 p-4 text-sm text-green-700">
            Check your email for a password reset link.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {error && (
              <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-ink">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border border-ink/20 px-3 py-2 text-ink"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-ink py-3 font-semibold text-lime disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send reset link"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-muted">
          <Link to="/login" className="underline">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}