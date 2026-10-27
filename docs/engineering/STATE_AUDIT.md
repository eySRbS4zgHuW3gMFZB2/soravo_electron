# Soravo State Audit Records

## Bounded review-fix audit - 2026-10-24

- CONFIRMED at `1ae7c4c402d11ee2f9f41dea9c2c5c88299a3aa3`: isolated assigned task checkout/branch, initially clean, sole registered worktree. Latest remote Website CI, CI and Packaging baseline runs succeeded; these results precede this patch.
- CONFIRMED: all four supplied auth/signup/device diagnostics findings were still present and repaired with no payment, entitlement, authorization or response contract changes.
- CONFIRMED: Node v24.21.0, npm 11.19.0; website lockfile dependencies installed successfully. Deno is unavailable, so device-handler behavior is checked through a temporary Node harness executing the transpiled function with synthetic Deno/Supabase fixtures; deployment/runtime compatibility remains unverified.
- No provider configuration, data or production state inspected or changed. Current patch validation is recorded in `workspace-context/validation-record.md` outside the repository; completion results are appended to the session handoff.

## Bounded P2-11 review-fix audit - 2026-10-24

- CONFIRMED at `66ac18f2f0275109960f7fd192a43be0214571dc`: sole task checkout on `coderabbit/clarify-task-scopes-webhook-claims/e23753fb`, initially clean; supplied task-scope, README path and claim-fencing findings all present.
- CONFIRMED: claim/reclaim token rotation and token/state predicates now fence ledger finalization; successful finalization must return one row. Website checks passed (29 tests, typecheck, build), as did disposable PostgreSQL/pgTAP suites (17 assertions) and the final handler rerun (10 tests).
- LIMITATION: payment/entitlement side effects still lack transactional claim fencing; live provider configuration, remote CI for this patch and Deno deployment were not exercised. No external state changed. Validation inputs and commands are recorded outside Git in `workspace-context/validation-record.md`.

## Preview and release infrastructure audit - 2026-10-27

- CONFIRMED: base commit e1c7337, branch feature/preview-and-release-pipeline.
- CONFIRMED: Cloudflare preview Pages project soravo-web-preview created with root=website, build=npm run build, output=dist, env VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY set to the Soravo_fresh Supabase project (public/publishable key only).
- CONFIRMED: Supabase target identity vfrhplskegqqdxbykyvx (Soravo_fresh), not the old soravo project.
- CONFIRMED: public release repository eySRbS4zgHuW3gMFZB2/soravo-releases created and a temporary release asset downloaded anonymously with HTTP 200.
- CONFIRMED: website typecheck and unit tests (42 pass), production build (446.61 kB JS), Playwright smoke/navigation (20 pass).
- CONFIRMED: SPA deep-link fallback added via website/public/_redirects.
- BLOCKED/LIMITATION: direct Cloudflare Pages deployment upload requires credentials/UI/manual process; no deployed preview yet. Release workflow creates a draft only and requires SORAVO_RELEASES_PAT; Linux remains blocked pending clean-machine runtime gate.


## Release gates and Pages routing review audit — 2026-10-27

- CONFIRMED at `7202d2b802da2ae0751dbd28b2096f2782b6a17d`: sole registered, initially clean task checkout at `repos/github.com/eysrbs4zghuw3gmfzb2/soravo_electron`, branch `coderabbit/release-gates-and-routing/d7d742a1`. All six supplied findings were verified against current files; workflow, routing tests and bounded documentation fixes are present in this task diff.
- CONFIRMED: every emitted NSIS installer has a required extraction/content gate before staging/upload; resolved release version equals Tauri config exactly; installer names match the entire version segment; source tags must resolve to the built commit before draft creation, whose target is that SHA.
- CONFIRMED: website typecheck/build, 42 unit tests and 29 browser tests passed (21 Vite, 8 built site through Wrangler Pages). Wrangler initially ignored the `/index.html` catch-all rewrite as a loop; rewriting to `/` passed without that warning. Pinned Wrangler 4.153.0 requires Node 22+; website CI already selects Node 22. Existing locked dependency versions are preserved.
- CONFIRMED: 63 release harness subprocess assertions passed, including real synthetic NSIS archives extracted by 7-Zip, required-file/extraction failures, exact version/filename cases, and missing, mismatched, lightweight and annotated local tags. Remote gh calls were replaced with an explicit local stub; no GitHub write occurred. Configuration verification and engineering-pack CI validation passed. Input hashes and exact commands are recorded in `workspace-context/validation-record.md` outside Git.
- CONFLICT: the pre-change ADR index marks ADR-0010 ACCEPTED, while the operating rule/planning records mark it PROPOSED. The explicit review request preserves the PROPOSED restriction; this patch retains it and leaves the index unchanged. ADR-0003 and ADR-0005 are consistently treated as accepted in the affected records.
- LIMITATIONS: real Windows build/MSI extraction, clean-machine runtime verification, remote release creation and remote CI for this patch were not exercised. Clean-machine verification and owner approval remain publication gates; the Linux gate applies before Linux publication. No provider, credential, production or repository-visibility change occurred.
