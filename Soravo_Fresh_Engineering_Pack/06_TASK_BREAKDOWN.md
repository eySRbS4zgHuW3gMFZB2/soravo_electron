# Detailed Task Breakdown

Use IDs in branch names, PR titles, worktree paths and progress notes.

**Every task below runs in its own dedicated Git worktree and named branch.** See `28_GIT_WORKTREE_POLICY.md`. The worktree path is `.worktrees/<task-id>-<slug>` and the branch is `<type>/<task-id>-<slug>`.

## P0 — Repo and baseline
**Order is significant (ADR-0009).** Backup and audit first, then CI, then rename preparation, then the rename itself.

- P0-01: Verify remote, default branch, local status, tags, worktrees and backup.
- P0-02: Establish baseline CI in `soravo_electron`, including the release-packaging check that proves the bundled artifact contains the engine.
- P0-03: Prepare and review the rename checklist — every integration a URL change could break: Actions workflows and secret scoping, `gh` invocations, Cloudflare Pages source link, OAuth and deep-link allowlists, release links, hard-coded GitHub URLs in README/docs/code.
- P0-04: With explicit owner approval only: rename historical repo to `soravo_deprecated`, then active repo to `soravo`; update the local clone path and remote.
- P0-05: Post-rename verification — remotes, Actions, secrets, permissions, Pages integration and deployment, OAuth/deep-link allowlists, release links, docs. Do not assume redirects cover third-party integrations.
- P0-06: Search for stale `soravo_electron`, old URLs, wrong framework claims and obsolete clone commands.
- P0-07: Capture baseline CI/tests and create state audit.
- P0-08: Add documentation index and mandatory session-start rules.
- P0-09: Confirm the live production site, DNS and email configuration are unchanged by everything above.

## P1 — Packaging and platform proof
- P1-01: Record the exact CrispASR binary path, version, SHA-256 and licence, re-confirming that the tracked location is `third-party/crispasr/extracted/crispasr-windows-x86_64-cpu/` and that `third-party/bin/` is git-ignored with no tracked files.
- P1-02: Identify required companion DLLs and dynamic runtime dependencies; confirm redistribution rights and notices.
- P1-03: **Implement the bundled layout accepted in ADR-0010** (2026-10-22, task P0-01): Tauri `bundle.resources` map form with bundled VC++ runtime, following the ADR’s tracked source paths, resource destinations and recorded rationale. Bundled files must be tracked in git so a clean clone and a clean CI runner produce identical artifacts.
- P1-04: Inspect the final installer contents and prove the engine and its dependencies are present.
- P1-05: **Linux engine verification.** Windows and Linux engine artifacts are now tracked and bundled (see ADR-0010 platform scope). Confirm licensing/redistribution, record SHA-256 and origin, then complete clean-machine Linux engine launch and dictation verification. Until this proof is recorded, **Linux support is BLOCKED**: no Linux build may be published, and Linux may not be named as a supported platform.
- P1-06: **Clean-machine install on Windows with no developer tools and no source tree:** the app must locate and launch the bundled engine with no `npm run fetch:asr` step, and must dictate. This is a release blocker.
- P1-07: Build Linux on a clean supported runner; identify system dependencies. **Part of the Linux release gate, not the Phase 1 Windows gate** - a verification build is permitted now using the tracked and bundled Linux artifacts, but nothing may be published or described as supported until the whole clean-machine gate passes.
- P1-08: Test microphone, hotkey hold/release, cancellation, text injection and offline use on Linux. Blocked behind P1-05 and P1-07. **Part of the Linux release gate, not the Phase 1 Windows gate.**
- P1-09: Produce SHA-256 manifest for test artifacts.

## P2 — Auth/database design
- P2-01: Create staging schema design; review it before migration. Do not reuse the historical project's schema.
- P2-02: Define RLS policies for every user-facing table.
- P2-03: Add server-side admin role assignment and checks.
- P2-04: Configure Supabase Auth URLs, redirect allowlist and custom SMTP.
- P2-05: Configure Resend sender domain, SPF/DKIM/DMARC as supported by current dashboard.
- P2-06: Test sign-up, sign-in, magic link, expired link, replay, sign-out, recovery and email rate limits.
- P2-07: Add migration reset/replay test in CI.
- P2-08: **Completed: Supabase Edge Functions chosen for the privileged backend; decision and rationale recorded in ACCEPTED ADR-0003.** Cloudflare Pages hosts the static website.
- P2-09: Record the existing DNS, MX, SPF, DKIM and DMARC configuration so business email survives any future DNS move.
- P2-10: Isolated Supabase setup and database-backed tests for device registration, entitlements, and webhook idempotency/claim semantics.
- P2-11: Reconcile WP-004 USD pricing and P2-10 DB tests with PR #22.
- P2-12: Atomic webhook provisioning RPC: fence payment, entitlement, and event finalization behind the current claim token in one transaction.
## P3 — Website
- P3-01: Create `website/` independent package and lockfile, built fresh per ADR-0008. Historical `soravo` repo is reference-only for approved content and behavior; do not port implementation, schema, migrations or Edge Functions.
- P3-02: Confirm design tokens and shadcn/ui usage; do not alter desktop Tailwind config to satisfy web.
- P3-03: Build responsive landing/pricing/features/download/help pages.
- P3-04: Build auth/account/dashboard routes.
- P3-05: Add privacy, terms, refund/cancellation, support and license policy pages.
- P3-06: Configure Cloudflare Pages previews and production deploy. Preview must never target the production hostname or production data.
- P3-07: Add Playwright E2E for core web routes and auth flows.
- P3-08: Verify keyboard accessibility, contrast, reduced motion and mobile layout.
- P3-09: Enumerate the existing production site's public URLs and classify each as Preserve, Redirect, Retire or Block. Retire/Block need explicit owner approval; everything else defaults to Preserve.

## P4 — Desktop account
- P4-01: Design secure deep-link protocol per Windows/Linux.
- P4-02: Implement short-lived callback exchange; reject invalid/replayed code.
- P4-03: Store refresh credentials in OS credential store.
- P4-04: Device registration and revocation.
- P4-05: Test 3-device monthly limit and unlimited lifetime.
- P4-06: Add logout, account switch, expired session and recovery UX.
- P4-07: **AUTH-DEV-SERVER-01 — Desktop development sign-in startup (owner E2E confirmed 2026-11-02).** Ensure the local website auth route is reachable when starting the desktop app for development. Acceptance: the documented default desktop dev command starts website Vite on port 5174 and desktop Vite on 5173 from the same checkout; strict ports prevent Vite from silently relocating either server; `/auth/desktop` is served; deep-link registration failures are fatal in development and logged without blocking Linux release startup; production behavior is otherwise unchanged. Owner confirmed sign-in completed and Open Soravo returned the authenticated session to the desktop app. Task worktree: `.worktrees/AUTH-DEV-SERVER-01`; branch progression: `fix/AUTH-DEV-SERVER-01` → `feature/AUTH-DEV-SERVER-01` (runtime PR #42) → `docs/AUTH-DEV-SERVER-01` (docs PR #43); initial integration base `1604cf219bc80ba25d9d85b64aacd37e760a9149` (`origin/main`). Skills loaded: `supabase`, `tauri-v2`, `playwright-best-practices`, `code-review`, `rust-best-practices`. Considered but not loaded: `security-review` (no auth/security contract changes), `playwright-cli` (used Playwright API route smoke; owner confirmed the full round-trip). CodeRabbit review completed on PR #42; the Linux release registration finding was fixed and revalidated. Risks: local port conflicts and accidental production-origin changes. Verification: dev server reachability, auth route HTTP response, website/desktop typecheck/build, Rust check and 38 library tests, owner E2E. Rollback: revert this task's scoped startup/config/docs changes.

## P5 — Entitlement
- P5-01: Define normalized entitlement API contract.
- P5-02: Implement Rust-side checks and typed states.
- P5-03: Add signed cache and 14-day grace.
- P5-04: Add lifetime offline indefinite state after activation.
- P5-05: Add expiry/recovery UI while preserving local data.
- P5-06: Test clock rollback, network failure, server 5xx, malformed response, schema mismatch.
- P5-07: Security review all entitlement code.

## P6 — Razorpay
- P6-01: Confirm merchant account capabilities, subscription support, currency and webhook setup.
- P6-02: Create plans/products in test mode.
- P6-03: Add server-side checkout/order creation.
- P6-04: Implement signature verification using current Razorpay docs.
- P6-05: Add webhook idempotency ledger and safe retries.
- P6-06: Add subscription lifecycle mapping and reconciliation.
- P6-07: Add refunds/cancellations/failed renewals.
- P6-08: Test duplicate, out-of-order, invalid signature, timeout and replay.
- P6-09: Owner performs a test payment and verifies entitlement and dashboard records.

## P7 — Admin and analytics
- P7-01: Admin role assignment path with no client self-promotion.
- P7-02: User totals and status summaries from authorized server query.
- P7-03: Revenue metrics from verified ledger only.
- P7-04: Lifetime license totals.
- P7-05: Link Cloudflare Web Analytics; clearly label metrics and time ranges.
- P7-06: Add audit log for admin changes.
- P7-07: Test direct API calls as ordinary user.
- P7-08: Owner-only admin dashboard: secure admin role table, server-side admin Edge Function, read-only overview/users/payments/subscriptions/devices/audit metrics.

## P8 — Release
- P8-00: **ADR-0005 accepted.** Remaining publication gates: clean-machine verification, the Linux release gate when publishing Linux artifacts, and owner approval of each release.
- P8-01: Public `eySRbS4zgHuW3gMFZB2/soravo-releases` artifacts-only repository created; use the host accepted in ADR-0005.
- P8-02: Configure artifact upload and release notes workflow.
- P8-03: Generate SHA256SUMS and verify it.
- P8-04: Optional minisign signing with private key outside CI/repo.
- P8-05: Test installation from a fresh download.
- P8-06: Publish the Windows guide with security-warning disclosure. Publish the Linux guide only after the Linux release gate passes.
- P8-07: Final privacy/legal/support review.
- P8-08: Owner approves launch; tag immutable version.
- P8-09: **Production cutover preparation** — complete the URL inventory from P3-09, configure and test redirects, take a restorable production data snapshot, and rehearse the rollback, per `27_PRODUCTION_CUTOVER_AND_ROLLBACK.md`.
- P8-10: **Production cutover** — a separate, explicitly owner-approved step. Do not retire, redirect or repoint `soravo.xyz` before this point, and do not change DNS or Cloudflare production settings without approval at that moment.

## P9 — Pill overlay reconstruction
- P9-01: **PILL-OVERLAY-01 — Reconstruct the floating dictation pill to closest permissible visual and behavioural parity with the reference overlay (Wispr Flow), from the current repository state.** Evidence-driven: measure the installed reference application, audit the current Soravo implementation, define an explicit two-mode (push-to-talk / hands-free) interaction state machine with session identifiers and stale-event protection, rebuild the native window, capsule rendering, waveform visualisation, controls, placement mode and drag interaction, verify recursively with screenshots, and add deterministic regression tests. CrispASR v0.8.43 remains untouched. Worktree: `.worktrees/PILL-OVERLAY-01-pill-overlay`; branch: `feature/PILL-OVERLAY-01-pill-overlay`; base `a9a5a8f`. Skills loaded: `tauri-v2`, `rust-best-practices`, `frontend-design` (partial). Considered but not loaded: `reverse-engineer-anything` (not installed in `../.agents/skills/`), `OpenCode`, `Report` (not installed), `playwright-*` (desktop native harness used instead), `shadcn` (existing ui components reused as-is), `supabase`, `cloudflare`, `wrangler`, `vercel-react-best-practices`, `design-taste-frontend-v1`, `security-review`, `code-review` (loads at review stage). Deliverables: `docs/pill-overlay/{reference-specification,current-implementation-audit,interaction-state-machine,iteration-log,verification-report}.md`.

## Every task must include
- a dedicated Git worktree and named branch, created per `28_GIT_WORKTREE_POLICY.md`, with the path, branch and base SHA recorded;
- acceptance criteria;
- tests and actual output, run in the worktree;
- security/privacy impact;
- rollback;
- docs/progress update;
- CodeRabbit review where useful and within free quota;
- no unresolved critical/high findings;
- worktree removal and build-output cleanup after integration.

## Task-specific work items

- SORAVO-DESKTOP-AUTH-REPAIR-30: Repair and accept the Windows desktop browser-auth flow, including deep-link lifecycle, PKCE handoff/OTP contract, secure session persistence, restart behavior, and documented evidence. Worktree: `.worktrees/SORAVO-DESKTOP-AUTH-REPAIR-30-desktop-auth`; branch: `fix/SORAVO-DESKTOP-AUTH-REPAIR-30-desktop-auth`.

## P2-email - Transactional email and Resend monitoring
- P2-EMAIL-01: Implement shared Resend email service, outbox migration, and webhook receiver.
