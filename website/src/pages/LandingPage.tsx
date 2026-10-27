import { Link } from "react-router-dom";

/** Render the public product overview, feature highlights, and pricing links. */
export function LandingPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-ink/10 px-6 py-4">
        <nav className="mx-auto flex max-w-6xl items-center justify-between">
          <span className="text-xl font-bold text-ink">Soravo</span>
          <div className="flex flex-wrap gap-6 text-sm">
            <Link to="/features" className="hover:underline">Features</Link>
            <Link to="/pricing" className="hover:underline">Pricing</Link>
            <Link to="/download" className="hover:underline">Download</Link>
            <Link to="/help" className="hover:underline">Help</Link>
            <Link to="/login" className="hover:underline">Log in</Link>
            <Link to="/signup" className="rounded-full bg-ink px-4 py-2 text-lime">Sign up</Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-24">
        <h1 className="text-5xl font-bold leading-tight text-ink">
          Voice dictation that stays on your machine.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted">
          Soravo transcribes speech locally using CrispASR. No cloud, no accounts
          required for dictation, no telemetry. Your words never leave your device.
        </p>
        <div className="mt-8 flex gap-4">
          <Link to="/pricing" className="rounded-full bg-lime px-6 py-3 font-semibold text-ink">
            Get started — $12/mo
          </Link>
          <Link to="/pricing" className="rounded-full border border-ink px-6 py-3 font-semibold text-ink">
            Lifetime — $50
          </Link>
        </div>

        <section className="mt-24 grid gap-8 md:grid-cols-3">
          {[
            { title: "Local-first", desc: "All transcription runs on-device via CrispASR. No cloud dependency." },
            { title: "30+ models", desc: "Whisper, Moonshine, Parakeet, Canary, and more. Download what you need." },
            { title: "Smart cleanup", desc: "Automatic punctuation, grammar, and formatting as you dictate." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-ink/10 p-6">
              <h3 className="text-lg font-semibold text-ink">{f.title}</h3>
              <p className="mt-2 text-sm text-muted">{f.desc}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-ink/10 px-6 py-8 text-center text-sm text-muted">
        <div className="flex flex-wrap justify-center gap-4">
          <Link to="/privacy" className="hover:underline">Privacy</Link>
          <Link to="/terms" className="hover:underline">Terms</Link>
          <Link to="/refunds" className="hover:underline">Refunds</Link>
          <Link to="/support" className="hover:underline">Support</Link>
          <Link to="/license" className="hover:underline">License</Link>
        </div>
        <p className="mt-4">&copy; {new Date().getFullYear()} Soravo. All rights reserved.</p>
      </footer>
    </div>
  );
}