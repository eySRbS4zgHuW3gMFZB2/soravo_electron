import { Link } from "react-router-dom";

export function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-ink/10 px-6 py-4">
        <nav className="mx-auto flex max-w-6xl items-center justify-between">
          <Link to="/" className="text-xl font-bold text-ink">Soravo</Link>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-16 prose">
        <h1 className="text-4xl font-bold text-ink">Privacy policy</h1>
        <p className="mt-4 text-muted">
          [OWNER/LEGAL REVIEW PLACEHOLDER] This page documents how Soravo handles account, payment, and
          device data. The final text must be reviewed and approved by the owner and qualified counsel
          before publication; no legal commitments are made here.
        </p>
        <p className="mt-4 text-muted">
          Dictation itself runs on your device. Soravo does not upload audio for transcription.
        </p>
      </main>
    </div>
  );
}