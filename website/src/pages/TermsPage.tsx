import { Link } from "react-router-dom";

export function TermsPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-ink/10 px-6 py-4">
        <nav className="mx-auto flex max-w-6xl items-center justify-between">
          <Link to="/" className="text-xl font-bold text-ink">Soravo</Link>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-4xl font-bold text-ink">Terms of service</h1>
        <p className="mt-4 text-muted">
          [OWNER/LEGAL REVIEW PLACEHOLDER] Final terms must be approved by the owner and qualified counsel
          before publication. This placeholder contains no binding commitments.
        </p>
      </main>
    </div>
  );
}