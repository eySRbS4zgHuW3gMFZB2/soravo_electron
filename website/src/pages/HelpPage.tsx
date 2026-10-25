import { Link } from "react-router-dom";

/** Answer common setup and licensing questions for new Soravo users. */
export function HelpPage() {
  const items = [
    { q: "Do I need an account to dictate?", a: "No. Accounts are only needed for paid plans and syncing from the website." },
    { q: "Where can I find billing support?", a: "Support channels are pending owner approval. Entitlements are server-authoritative and cannot be changed from the browser." },
    { q: "How many devices can I use?", a: "Monthly plans allow up to 3 active devices; lifetime plans have no limit." },
    { q: "Does dictation work offline?", a: "Yes. Monthly plans include a 14-day offline grace; lifetime plans work indefinitely offline." },
  ];

  return (
    <div className="min-h-screen">
      <header className="border-b border-ink/10 px-6 py-4">
        <nav className="mx-auto flex max-w-6xl items-center justify-between">
          <Link to="/" className="text-xl font-bold text-ink">Soravo</Link>
          <div className="flex gap-6 text-sm">
            <Link to="/pricing" className="hover:underline">Pricing</Link>
            <Link to="/support" className="hover:underline">Support</Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-4xl font-bold text-ink">Help</h1>
        <div className="mt-10 space-y-6">
          {items.map((item) => (
            <div key={item.q}>
              <h2 className="text-lg font-semibold text-ink">{item.q}</h2>
              <p className="mt-2 text-muted">{item.a}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}