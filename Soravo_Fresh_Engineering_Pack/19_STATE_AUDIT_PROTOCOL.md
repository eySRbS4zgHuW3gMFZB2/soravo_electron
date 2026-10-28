# State Audit Protocol

This file prevents agents from acting on stale summaries.

## Audit at start of a major task
Record the date and commit SHA. Inspect:
- repository owner/name/visibility/default branch;
- remote URL, local folder, current branch and dirty state;
- **the full worktree list** - path, branch, base SHA, uncommitted file count, upstream tracking and build-output size for each. Any worktree on a detached HEAD is reported as a defect. A worktree directory whose registration is marked `prunable` is cleaned with `git worktree prune`, **but only after `git worktree list --porcelain` has been inspected and a rescue branch created at any detached HEAD that still holds work** — pruning removes the registration and with it the only readily identifiable reference to that commit. See `28_GIT_WORKTREE_POLICY.md`;
- top-level file tree and key manifests;
- workflow files and recent CI;
- test commands and actual outputs;
- Windows/Linux build toolchain;
- **re-confirm any recorded audit finding about file layout or paths against the current checkout** — in particular the CrispASR engine's tracked location (`third-party/crispasr/extracted/crispasr-windows-x86_64-cpu/`) versus the git-ignored `third-party/bin/`, and the `bundle.resources` / `bundle.externalBin` / `csp` values in `src-tauri/tauri.conf.json`. A finding is a claim about a moment in time, not a permanent fact;
- current Supabase project status/schema/migrations without exposing secrets;
- Cloudflare Pages project and domain configuration, including whether the production deployment still serves correctly;
- Resend sender verification/usage;
- Razorpay account mode/webhook status without exposing credentials;
- CodeRabbit CLI version/auth/quota;
- installed skill and MCP connection state.

## Safe commands (adapt to shell)
- `git status --short --branch`
- `git remote -v`
- `git log -1 --oneline --decorate`
- `git branch --show-current`
- `git worktree list`
- `git ls-files | head -200` (PowerShell equivalent if needed)
- `node --version`
- `npm --version`
- `rustc --version`
- `cargo --version`
- `rustup show`
- `gh auth status`
- `coderabbit --version`
- `coderabbit review --help`

Do not print environment variable values or secrets. Avoid `env`, `set`, or dumping full config files that may contain credentials.

## VM audit for a non-developer owner
The agent should perform this audit itself where it has access. If owner must run something, provide one copy/paste command at a time, explain where to run it, what normal output looks like, and ask them to return output. Never send a long unannotated shell script to a non-developer.

## Audit output
Write `docs/engineering/STATE_AUDIT.md` containing:
- confirmed facts with evidence;
- inferred facts;
- unknowns;
- failed checks;
- blockers;
- recommended next action;
- date and commit SHA.

Never replace unknown with an assumption. Update this audit after repo rename, CI setup, auth setup, schema changes, and release readiness review.

## Worktree audit

Report every worktree found, including ones created by earlier sessions. For each: path, branch (or detached HEAD), base SHA, uncommitted files, upstream tracking and build-output size. Clean up `prunable` registrations, and record any worktree holding uncommitted work — it exists nowhere else and must not be removed casually.

Dated audit records are preserved in `docs/engineering/STATE_AUDIT.md`.

## 2026-10-27 — Auth mock CORS validation

Runtime-isolated checkout on `coderabbit/auth-test-cors-preflight/73226cf9`, base `15dff3c59e870f797705ff7142c7495482e102ea`; one named worktree, initially clean. Scoped test-only CORS repair; validation and environment evidence in `workspace-context/validation-record.md`. No integration or remote changes.

### 2026-10-27 — Delivery conflict resolution

Merged remote head `5c34e97bf0d04c4716c9b4af9c6e49a18c6bd433` into task commit `9e48ed2` on `feature/supabase-resend-auth-e2e`. Retained remote JSON mock helper, CORS methods, unit-test script and password recovery changes; retained typed Route handling and Supabase API version header allowance. Fresh checks passed: auth browser 7/7, route harness 12/12, unit tests 48/48, website/spec typecheck and build. No push performed.


## 2026-10-27 — Recovery visibility review (87c71ff9)

Confirmed sole isolated worktree on `coderabbit/verify-password-recovery-state/87c71ff9`, base `260ff874d256694cdd607c0703617cb0b13375ef`, initially clean. Fixed loading and missing-ID recovery verification gaps; retained provider in-memory/storage behavior. Website tests 63/63, typecheck/build and recovery browser smoke 1/1 pass. See matching handoff entry and workspace validation record for commands, hashes and browser preparation; no integration or remote changes.


## 2026-10-27 — Recovery initialization review (7804fa0e)

Confirmed sole runtime-isolated named worktree on `coderabbit/fix-password-recovery-loading/7804fa0e`, base `cfb565df8ce325c834c79ced3f66ec329fddb30b`, initially clean. Supplied finding reproduced and repaired without changing recovery authorization. Targeted tests 36/36, full website suite 68/68, typecheck/build passed. Base Website CI/CI/Packaging passed; no patch CI or integration. Auth browser suite 7/7 and manual diff/security checks passed. Exact validation outcomes are recorded in workspace-context/validation-record.md outside Git; see matching handoff entry.
Subscription checkout/event-ordering audit recorded in `docs/engineering/STATE_AUDIT.md` on 2026-10-27 for task branch `coderabbit/api-subscription-hardening/8b15d30d` (base `74ec17e`).

Delivery merge against remote `147fd33` was audited on 2026-10-27 in `docs/engineering/STATE_AUDIT.md`; atomic subscription migration is now 005.

Subscription insert error follow-up checked at `f45731b86f01481601426ed7c12f85feedfa4907` on 2026-10-27 in the isolated `coderabbit/fix-subscription-insert-errors/969be6a5` checkout. Finding dispositions, unchanged reservation/RPC contracts and validation are recorded in `18_PROGRESS_AND_HANDOFF.md` and the workspace validation record. No external provider or production state was accessed.

Checkout lookup/locking review audit (2026-10-27): isolated branch `coderabbit/harden-checkout-error-handling-locking/c935e5b0`, base `f45731b86f01481601426ed7c12f85feedfa4907`; initial tree clean. Scoped handler/migration/tests changes passed website checks, all database CI SQL tests and overlapping-session advisory-lock checks. No integration or production changes. Evidence: external `workspace-context/validation-record.md`; handoff above.

Delivery merge audit (2026-10-27): merged remote `b645e8246c4089c9ca6f73bdc9a25b0d577e884f` with local `d8d7ec4a8d49b05d575e22976d66a76f4d182867` on runtime delivery branch `feature/razorpay-recurring-sandbox`. Both parent handoff/audit additions retained; combined source/tests verified. Fresh 30 checkout tests and 88 PostgreSQL assertions passed; unchanged 64 tests/typecheck/build results reused. Merge committed locally for delivery, without pushing; details in the latest handoff and external validation record.

Cancellation deadline/guideline audit follow-up (2026-10-27): isolated runtime branch `coderabbit/bound-cancellation-and-update-audit/8e133da2`, base `10da4424140e30beb80ed5361a81f904c4d4da52`, initially clean. Confirmed root `AGENTS.md` and engineering-pack reading gate apply; corrected the earlier audit statement. Cancellation now aborts after five seconds while preserving HTTP 500 and the reconciliation reservation. Fresh 31 checkout tests, all 95 website tests and website typecheck/build passed. Manual diff/security and whitespace checks passed; live provider/Deno deployment unverified. Detailed evidence: external workspace validation record and latest handoff.


Confirmation feedback review audit (2026-10-28): initially clean isolated runtime checkout on `coderabbit/fix-auth-confirmation-feedback-and-id/28d529e5`, base `978955a250c3039e8294eb56a9fcdc72bccb6b6e`. All three findings confirmed and fixed under P2-13. Auth callback classification, protected-account/login error visibility and task-ID preservation checked; 137 website unit tests, 37 browser tests, typecheck/build passed. AccountPage unchanged; no provider settings or production changes. Detailed evidence: external workspace validation record and latest handoff.

Signup confirmation guard audit (2026-10-28): initially clean sole runtime-isolated worktree on `coderabbit/guard-signup-confirmation-status/9e5a84fe`, base `659df9ed156a0fffbf199c8ed7ca9d4c219bfe8b`. Finding verified and fixed under P2-13. Targeted 55 and full 140 unit tests, all 37 browser tests and typecheck/build passed; missing Chromium was installed before the successful browser rerun. Evidence and manual review are in the external workspace validation record and matching handoff. No provider configuration or production changes.
