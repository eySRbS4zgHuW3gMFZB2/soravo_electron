import { Link } from "react-router-dom";

export function RefundsPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-ink/10 px-6 py-4">
        <nav className="mx-auto flex max-w-6xl items-center justify-between">
          <Link to="/" className="text-xl font-bold text-ink">Soravo</Link>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-4xl font-bold text-ink">Refunds and cancellation</h1>
        <p className="mt-4 text-muted">
          [OWNER/LEGAL REVIEW PLACEHOLDER] Refund and cancellation terms require owner/legal approval and
          must match the implemented Razorpay lifecycle. No refund promises are made here.
        </p>
      </main>
    </div>
  );
}