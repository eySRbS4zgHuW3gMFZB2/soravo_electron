# Source Audit Notes — 2026-10-22

This is a snapshot of the public source inspected for the documentation plan, not a claim that every behavior was built or tested in this audit.

## Repository metadata
- GitHub repo: `eySRbS4zgHuW3gMFZB2/soravo_electron`
- Visibility: public at audit time.
- Default branch: `main`.
- Repository package name: `soravo`.
- README identifies Tauri v2, React 18, TypeScript, Vite, Rust and SQLite.

## Important files observed
- `README.md`
- `AGENTS.md`
- `DESIGN.md`
- `MODELS.md`
- `progress.md`
- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`

## Findings requiring action
1. Stale repo name: clone instructions point to `soravo_electron`.
2. Conflicting historical transcription descriptions: README begins with Whisper/whisper.cpp wording but later states CrispASR; progress history also records both. Owner has resolved the product choice: current CrispASR stays. Update copy after validating actual code.
3. **CrispASR packaging — corrected finding, re-confirmed against the checkout on 2026-10-22.**
   - `bundle.resources` is `[]` and `bundle.externalBin` is `[]`, so the Tauri bundler copies **nothing** from the repository into the installed application.
   - `third-party/bin/` is listed in `.gitignore` and contains **0 tracked files**. It holds ~40 files on a developer machine only, produced by the developer-only fetch script (`npm run fetch:asr`). A clean clone does not have it.
   - The Windows engine **is** committed, at `third-party/crispasr/extracted/crispasr-windows-x86_64-cpu/` — `crispasr.exe` (~18.3 MB), `openblas.dll` (~1.7 MB), `crispasr-quantize.exe` (~0.6 MB), `LICENSE` and `THIRD_PARTY_NOTICES.txt`. The source archive `third-party/crispasr/crispasr.zip` (~8.7 MB) is also committed.
   - The runtime lookup in `src-tauri/src/lib.rs` (`find_crispasr_binary`) searches, in order: `<root>/third-party/bin/<exe>`, then the immediate children of `<root>/third-party/crispasr/extracted/`, across the roots `current_dir`, `project_root` and the Tauri `resource_dir`. On an installed machine none of the first two roots exist, and `resource_dir` contains no engine because `bundle.resources` is empty.
   - Consequence: **an installed build cannot locate the engine**, and the app's own error text for that case ("CrispASR is not installed. Run `npm run fetch:asr` to download it.") is meaningless to an end customer. README's statement that the engine "is included in `third-party/bin/`" is wrong on two counts: that path is not tracked, and it is not bundled.
   - **Treat the paths above as an audit finding, not a settled design.** Re-confirm them against the checkout at implementation time, then choose an explicit, tracked staging path for the bundled engine and record that choice in an ADR (see ADR-0010).
   - Required before release: a **clean-machine install** (no developer tools, no source tree) must demonstrate that the app locates and launches the bundled engine, with no developer-only fetch step. Required runtime dependencies, model acquisition and licensing, and Windows/Linux packaging checks are part of that gate. Do not bundle files blindly — confirm redistribution rights first (see `22_REVERSE_ENGINEERING_AND_PROVENANCE.md`).
4. `csp: null` was present. Add restrictive CSP before commercial auth/network integration.
5. Bundle targets set to `all`; this is not evidence Linux works. Build and test Linux explicitly.
6. README describes local-only/no accounts/no cloud, which will become outdated once accounts/licensing are added. Rewrite accurately before release; retain the fact that audio/transcription remains local.
7. Existing app package and Tauri identifiers use `com.soravo.app`; treat as stable unless an ADR says otherwise, because changing identifiers may affect existing local data paths and OS registration.
8. Existing `package.json` uses npm and declares `npm@11.16.0`; retain npm unless there is a justified ADR. Do not switch to pnpm casually.
9. Current `tauri.conf.json` lists Windows/macOS/Linux icons and `targets: all`, but actual packaging and runtime must be verified on each launch platform.
10. Current root app `build` command runs TypeScript typecheck and Vite build. CI should invoke it and Rust checks.

## Not verified in this audit
- Current local working-tree state.
- Current CI pass/fail status.
- **CrispASR binary and companion DLL hashes/contents.** Paths were confirmed; cryptographic hashes and the exact runtime dependency closure were not.
- Whether the committed `crispasr.zip` and the extracted tree are byte-identical to each other.
- Linux build and real microphone/hotkey/text-injection behavior.
- Existing Supabase/Cloudflare/Resend/Razorpay account state.
- Exact CodeRabbit quota at the time this pack is used.
- Existing branch protections and repository rename availability.

## Later verification notes
- **2026-10-22, engine packaging:** the paths in finding 3 were re-confirmed by direct inspection of the working tree and `git ls-files`. A release build was produced for inspection: `Soravo_0.1.0_x64_en-US.msi` (~6.15 MB) and `Soravo_0.1.0_x64-setup.exe` (~4.28 MB). Both are far smaller than the ~20 MB engine, which corroborates that the engine is not present in the bundle. This is a corroborating observation, not a substitute for the clean-machine install gate.

