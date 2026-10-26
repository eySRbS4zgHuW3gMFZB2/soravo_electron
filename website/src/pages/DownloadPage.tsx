import { Link } from "react-router-dom";

/** Present download guidance and platform support status without implying unsupported releases. */
export function DownloadPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-ink/10 px-6 py-4">
        <nav className="mx-auto flex max-w-6xl items-center justify-between">
          <Link to="/" className="text-xl font-bold text-ink">Soravo</Link>
          <div className="flex gap-6 text-sm">
            <Link to="/pricing" className="hover:underline">Pricing</Link>
            <Link to="/help" className="hover:underline">Help</Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-4xl font-bold text-ink">Download</h1>
        <p className="mt-4 text-lg text-muted">
          Windows installers will be published on the releases page with SHA-256 checksums.
        </p>
        <div className="mt-8 rounded-xl border border-ink/10 p-6">
          <h2 className="text-xl font-semibold text-ink">Windows</h2>
          <p className="mt-2 text-sm text-muted">
            Windows support is planned. The installer and SHA-256 checksum have not been published yet,
            so no download is currently available.
          </p>
          <a
            href="https://github.com/eySRbS4zgHuW3gMFZB2/soravo/releases"
            className="mt-4 inline-block rounded-full border border-ink px-6 py-3 font-semibold text-ink"
          >
            View release status
          </a>
        </div>
        <div className="mt-6 rounded-xl border border-ink/10 p-6">
          <h2 className="text-xl font-semibold text-ink">Linux</h2>
          <p className="mt-2 text-sm text-muted">
            Linux support is being prepared. A Linux build is not currently published or supported.
          </p>
        </div>
      </main>
    </div>
  );
}