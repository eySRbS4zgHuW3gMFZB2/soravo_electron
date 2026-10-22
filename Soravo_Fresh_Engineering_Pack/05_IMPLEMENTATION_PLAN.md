# Implementation Plan and Phase Gates

Do not begin by implementing everything in one agent run. Work in small, reviewable tasks, with a durable progress update at each handoff.

## Phase 0 — Repository identity and baseline audit
**Order matters (owner decision memo, decision 2; ADR-0009).** The rename is **not** the first action of this phase. The order is: backup and audit → baseline CI and release-packaging check → rename checklist preparation → rename → post-rename verification. Renaming first would hand the renamed repository automation and secret scoping that has never been proven to work.

**The release-packaging check starts in Phase 0 but cannot pass until Phase 1.** The current Tauri configuration bundles no engine, so a check asserting "the engine is in the bundle" is expected to **fail** at the Phase 0 baseline. This is a known, recorded baseline failure, not a broken gate. The check is *created and wired* in Phase 0 so that the rename inherits a real, running check; it becomes **green** in Phase 1 when the bundle layout is implemented. See "The packaging-check baseline exception" below.

Deliverables, in order:
- Snapshot/backup current active repo and verify clean working tree. Record remote, default branch, HEAD SHA, branches, worktrees and existing integration configuration.
- Establish baseline CI in the current active repository `soravo_electron`, and add the release-packaging check that tests whether the CrispASR engine is present in the built bundle. **Record its result as the baseline.** It is expected to be red at this point, and the recorded red result is the baseline.
- Prepare the rename checklist: every integration that a repository URL change could break - GitHub Actions workflows and their secret scoping, `gh` invocations, the Cloudflare Pages source link, OAuth and deep-link allowlists, release links, and hard-coded GitHub URLs in README, docs and code.
- Only then, and only with explicit owner approval, rename the historical repository to `soravo_deprecated`, then the active repository to `soravo`; rename the local folder after the remote change.
- After renaming, re-verify remotes, GitHub Actions, secrets and permissions, Cloudflare Pages integration and deployment, OAuth/deep-link allowlists, release links and documentation. Do not assume GitHub redirects guarantee every integration follows.
- Keep the active repo public while exploiting public-repo CI; make it private before commercial source launch, after confirming workflows, secrets and release repository design. This decision is separate from the rename and is also owner-approved.
- Reconcile README, `AGENTS.md`, `DESIGN.md`, `MODELS.md`, `progress.md`, package metadata and target platform statements. The README's statement that the engine "is included in `third-party/bin/`" is incorrect and must be corrected (see Phase 1).
- Produce `docs/engineering/STATE_AUDIT.md` with actual tree, installed toolchain, current tests and known gaps.
- **Do not touch the live production site, DNS, or Cloudflare production settings during this phase.** The current production deployment stays exactly as it is; see `27_PRODUCTION_CUTOVER_AND_ROLLBACK.md`.

### The packaging-check baseline exception

| Stage | Packaging check state | Gate |
|---|---|---|
| Phase 0 (P0-02) | Created, wired, and **red** — the engine is not bundled yet | Rename requires the check to **exist, run, and report**, with its red result recorded as the known baseline. It is **not** required to be green. |
| Phase 1 (P1-03, P1-04, P1-06) | Implemented and **green** — the bundle layout ships the engine and a clean-machine install proves it launches | The packaging check becomes a hard, required, green check. No release may ship while it is red. |

The rename gate therefore requires *proof that the check works*, not *proof that the engine ships*. Requiring green in Phase 0 would be circular: the bundle layout is not chosen until P1-03, so nothing could satisfy it before the rename. If the packaging check is red in Phase 0 for a reason **other** than the known missing-engine baseline — for example it fails to run at all — that is a genuine failure and the rename must not proceed.

Gate: repo identity and branch/remote verified; no accidental source deletion; baseline CI green **or** failures documented with the packaging check's red result explicitly recorded as the known baseline; rename checklist reviewed by the owner; production site demonstrably unchanged.

## Phase 1 — Desktop release readiness (blocker before selling)
- Record the CrispASR engine's exact binary path, version, SHA-256 and licence, re-confirming the audited finding that the tracked location is `third-party/crispasr/extracted/crispasr-windows-x86_64-cpu/` and that `third-party/bin/` is untracked.
- Decide and record the bundled layout in **ADR-0010** (Tauri `bundle.resources` mapping, `externalBin` sidecar, or a deliberate rename of the tracked staging directory), then implement it. The bundled files must be tracked in git so a clean clone and a clean CI runner produce the same artifact.
- Identify required companion DLLs and dynamic runtime dependencies; confirm redistribution rights and notices before bundling anything (`22_REVERSE_ENGINEERING_AND_PROVENANCE.md`).
- Verify model download, checksum, licence/provenance and offline transcription. Models are acquired at runtime, not bundled.
- Build and inspect the Windows installer; confirm the engine and its dependencies are present in the artifact.
- **Clean-machine install test:** install on a Windows machine with no developer tools and no source tree, and prove the app locates and launches the bundled engine with no `npm run fetch:asr` step and can dictate.
- Add Linux CI build and real Linux smoke test; determine supported distro/package formats.
- Add app version display, crash-safe logging and privacy-preserving diagnostics.
Gate: clean VM install works without dev tools and can dictate using the documented model flow, with the engine coming from the bundle.

## Phase 2 — Commercial contracts and service setup
- Confirm domain and product email sender ownership. Record existing DNS, MX, SPF, DKIM and DMARC exactly, so that any later DNS move can reproduce them and business email survives.
- Set up/verify Supabase project and migrations from scratch for the active Tauri product. Do not reuse the historical project's schema or data.
- **Choose the privileged backend (Pages Functions/Workers versus Supabase Edge Functions) and record the decision and rationale in ADR-0003** (task P2-08) before implementation depends on it.
- Configure Resend SMTP and test magic-link delivery to addresses outside the project team.
- Define RLS and server functions.
- Configure staging and production environment separation.
Gate: auth/security tests pass; no production secrets in repo or prompts; ADR-0003 ACCEPTED.

## Phase 3 — Website foundation and account system
- Add `website/` as independent app, built **fresh** per ADR-0008. The historical `soravo` repository (renamed to `soravo_deprecated` in Phase 0) may be consulted for approved content and behavior only; do not port its implementation, schema, migrations or Edge Functions.
- Cloudflare Pages preview/production pipeline, route and environment mapping. Preview deployments must not target the production hostname or production data.
- Build marketing pages and account pages.
- Implement sign-up, sign-in, sign-out, recovery, email verification and safe error states.
- Add user profile and device dashboard shell.
Gate: web auth tests pass; preview uses staging only; accessibility smoke tests pass; the live production site is unchanged.

## Phase 4 — Desktop browser auth and device registration
- Register custom deep link for supported OSes and document installation behavior.
- Implement browser sign-in using short-lived one-time callback code; no tokens in URL.
- Store credentials in OS credential storage.
- Register device; enforce 3-device monthly cap atomically.
- Lifetime entitlements do not enforce device cap.
Gate: successful sign-in, cancelled sign-in, expired code, duplicate code, revoked device, 4th monthly device, unlimited lifetime devices all tested.

## Phase 5 — Entitlement and offline policy
- Implement server contract and Rust-side enforcement.
- Add signed/versioned entitlement cache and 14-day monthly grace.
- Lifetime entitlement is indefinitely offline after activation.
- Define expiry UX, recovery UX, system clock rollback behavior and data export.
Gate: offline matrix tests pass, no renderer-only authorization, no local data deletion on expiry.

## Phase 6 — Payments
- Razorpay sandbox/test mode first.
- Implement server-side order/subscription creation and verified webhooks.
- Add idempotency and replay tests; reconcile pending payments.
- Add cancel/renew/failure/refund/chargeback paths.
- Never provision entitlement from browser redirect.
Gate: end-to-end sandbox suite passes and a manual owner test is recorded before live mode.

## Phase 7 — Admin dashboard and analytics
- Role-gated admin view with server authorization.
- Users, active subscriptions, lifetime sales, verified gross sales, refunds and payment reconciliation.
- Cloudflare Web Analytics link/reporting; don't fabricate visitor counts.
- Add audit events for privileged changes.
Gate: normal users cannot access admin API even by direct request; admin changes audited.

## Phase 8 — Distribution, production cutover and launch
- **Finalise ADR-0005 (binary distribution host) before publishing anything.** It is currently PROPOSED; the host, the no-card check and an anonymous-download proof must be settled first.
- Publish artifacts to the selected public binary host.
- SHA-256SUMS and optional minisign signatures. Verify a clean download and checksum from a second machine and network.
- Windows installer warning copy and Linux installation guide.
- Legal/privacy/support pages and refund/cancellation policy approved.
- Make source repo private only after launch-source policy is settled; binary release host stays public.
- **Production cutover is a separate, explicitly approved step.** Follow `27_PRODUCTION_CUTOVER_AND_ROLLBACK.md`: complete the URL inventory and classification, configure and test redirects, rehearse the rollback, then cut over. Do not retire, redirect or repoint `soravo.xyz` before this point.
Gate: `13_RELEASE_RUNBOOK.md` checklist fully checked, `27_PRODUCTION_CUTOVER_AND_ROLLBACK.md` prerequisites all evidenced, and the owner signs the release approval and the cutover approval.

## Phase discipline

Each phase has an explicit entry checklist, output artifact, automated tests, manual owner checks and a rollback path. Do not start a dependent phase if its gate is red unless the owner approves a recorded exception.

## Task discipline

**Every task runs in its own dedicated Git worktree and named branch.** See `28_GIT_WORKTREE_POLICY.md`.

- One task, one worktree, one branch. The branch name carries the task ID: `<type>/<task-id>-<slug>`.
- Create the worktree from `origin/main` with an explicit branch. Never leave a worktree on a detached HEAD.
- All edits happen inside the worktree. The main working tree is not edited during a worktree task.
- Never touch another worktree's files, branch, index or stash. The stash is repository-wide and shared by every worktree.
- Tests and review run in the worktree, against the worktree's diff, before integration. Nothing merges on the strength of a task's own claim that it works.
- After integration: remove the worktree, `git worktree prune`, delete the merged local branch, and delete the worktree's build output. A Rust worktree carries its own multi-gigabyte `src-tauri/target`.
- Record the worktree path, branch and base SHA in `18_PROGRESS_AND_HANDOFF.md`.
- A task completed without a worktree where one was required is a reportable deviation and needs the owner's recorded approval.

Phases are not worktrees. A phase is a sequence of tasks; each task inside it gets its own worktree, and the phase's gate is evaluated on the integrated result.
