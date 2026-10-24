import { Link } from "react-router-dom";

export function PricingPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-ink/10 px-6 py-4">
        <nav className="mx-auto flex max-w-6xl items-center justify-between">
          <Link to="/" className="text-xl font-bold text-ink">Soravo</Link>
          <div className="flex gap-6 text-sm">
            <Link to="/login" className="hover:underline">Log in</Link>
            <Link to="/signup" className="rounded-full bg-ink px-4 py-2 text-lime">Sign up</Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-24">
        <h1 className="text-center text-4xl font-bold text-ink">Simple pricing</h1>
        <p className="mt-4 text-center text-lg text-muted">
          Choose the plan that works for you. All plans include full access to Soravo.
        </p>

        <div className="mt-16 grid gap-8 md:grid-cols-2">
          {/* Monthly */}
          <div className="rounded-2xl border border-ink/10 p-8">
            <h2 className="text-2xl font-bold text-ink">Monthly</h2>
            <p className="mt-2 text-4xl font-bold text-ink">
              $12<span className="text-lg font-normal text-muted">/month</span>
            </p>
            <ul className="mt-6 space-y-3 text-sm text-muted">
              <li>✓ Full dictation access</li>
              <li>✓ Up to 3 active devices</li>
              <li>✓ 14-day offline grace</li>
              <li>✓ All 30+ ASR models</li>
              <li>✓ Smart cleanup &amp; dictionary</li>
            </ul>
            <Link
              to="/signup?plan=monthly"
              className="mt-8 block rounded-full bg-ink py-3 text-center font-semibold text-lime"
            >
              Create account for monthly
            </Link>
          </div>

          {/* Lifetime */}
          <div className="rounded-2xl border-2 border-lime bg-lime/5 p-8">
            <div className="mb-2 inline-block rounded-full bg-lime px-3 py-1 text-xs font-bold text-ink">
              Best value
            </div>
            <h2 className="text-2xl font-bold text-ink">Lifetime</h2>
            <p className="mt-2 text-4xl font-bold text-ink">
              $50<span className="text-lg font-normal text-muted"> one-time</span>
            </p>
            <ul className="mt-6 space-y-3 text-sm text-muted">
              <li>✓ Full dictation access forever</li>
              <li>✓ Unlimited devices</li>
              <li>✓ Indefinite offline operation</li>
              <li>✓ All 30+ ASR models</li>
              <li>✓ Smart cleanup &amp; dictionary</li>
              <li>✓ All future updates</li>
            </ul>
            <Link
              to="/signup?plan=lifetime"
              className="mt-8 block rounded-full bg-lime py-3 text-center font-semibold text-ink"
            >
              Create account for lifetime
            </Link>
          </div>
        </div>

        <p className="mt-12 text-center text-sm text-muted">
          Payments processed securely via Razorpay. Prices in USD.
        </p>
      </main>
    </div>
  );
}