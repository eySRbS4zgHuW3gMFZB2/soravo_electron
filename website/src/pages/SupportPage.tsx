import { Link } from "react-router-dom";

export function SupportPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-ink/10 px-6 py-4">
        <nav className="mx-auto flex max-w-6xl items-center justify-between">
          <Link to="/" className="text-xl font-bold text-ink">Soravo</Link>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-4xl font-bold text-ink">Support</h1>
        <p className="mt-4 text-muted">
          [OWNER/LEGAL REVIEW PLACEHOLDER] Support channels and response commitments are pending owner
          approval. For now, account inquiries should include the account email only.
        </p>
      </main>
    </div>
  );
}