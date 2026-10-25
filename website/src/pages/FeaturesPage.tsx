import { Link } from "react-router-dom";

/** Describe Soravo's local-first dictation capabilities in a responsive feature grid. */
export function FeaturesPage() {
  const features = [
    { title: "Local-first transcription", desc: "All audio processing runs on your machine using CrispASR. No cloud upload." },
    { title: "30+ models", desc: "Whisper, Moonshine, Parakeet, Canary and more. Download only what you need." },
    { title: "Smart cleanup", desc: "Automatic punctuation, capitalization and formatting as you speak." },
    { title: "Global hotkey", desc: "Push-to-talk from any application without switching windows." },
    { title: "Privacy by default", desc: "No telemetry, no accounts required for dictation, no audio retention." },
    { title: "Offline operation", desc: "Once models are downloaded, dictation works without a network connection." },
  ];

  return (
    <div className="min-h-screen">
      <header className="border-b border-ink/10 px-6 py-4">
        <nav className="mx-auto flex max-w-6xl items-center justify-between">
          <Link to="/" className="text-xl font-bold text-ink">Soravo</Link>
          <div className="flex gap-6 text-sm">
            <Link to="/pricing" className="hover:underline">Pricing</Link>
            <Link to="/download" className="hover:underline">Download</Link>
            <Link to="/login" className="hover:underline">Log in</Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16">
        <h1 className="text-4xl font-bold text-ink">Features</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted">
          Soravo is a desktop dictation app built around local inference.
        </p>
        <section className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <article key={feature.title} className="rounded-xl border border-ink/10 p-6">
              <h2 className="text-lg font-semibold text-ink">{feature.title}</h2>
              <p className="mt-2 text-sm text-muted">{feature.desc}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}