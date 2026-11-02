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

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:2e97c620355bc30888cadc4e7084594bf4194da26d0da06dc277fe54d65dca7d -->

## 2026-10-30 — P7-08 readiness repair round 1

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:16de02ff72474c60eaa549487146019dd5ccabb6ce1558a778217fc152c6de5b -->

Confirmed expected head `4052f9ba9c2d7dea88a9821aa198c2027f320a12`, clean initial state and sole named runtime-isolated checkout on `coderabbit/admin-dashboard-readiness-fixes/triage_r`. Scoped admin aggregate/search/retry/pagination repairs preserve authorization and fail-closed audit policy. Fresh 28 handler/API/UI tests, 29 pgTAP assertions after migration replay, Deno check, website typecheck/build and 3 admin browser tests passed. Exact commands, input hashes, initial fixture correction and outstanding review/remote-CI limitations are in `workspace-context/validation-record.md` outside Git. No integration, push or provider mutation performed. Detailed audit appended to `docs/engineering/STATE_AUDIT.md`.

## 2026-10-30 — P7-08 readiness repair round 3

Sole registered worktree: `repos/github.com/eysrbs4zghuw3gmfzb2/soravo_electron`, branch `feature/P7-08-admin-dashboard-hardening`, base `ca48d47231a2ca76526a8fd9a9bc0adee5a29bcd`; initially 0 uncommitted files; no configured upstream. Initial build-output size is unknown; `website/dist` measured 475795 bytes after the local build. Findings, scoped verification, migration order and limitations are in the matching handoff and external validation record. No integration, push or provider mutation performed.


<!-- /coderabbit-ai-generated:v1 -->


<!-- /coderabbit-ai-generated:v1 -->

## State audit — AUTH-DEV-SERVER-01 — 2026-11-02

- Remote `origin`; integration base `origin/main` at `1604cf219bc80ba25d9d85b64aacd37e760a9149` (PR #41 merge).
- Task worktree: `C:\Users\kaya\Desktop\Hydra\soravo\.worktrees\AUTH-DEV-SERVER-01`; branch `fix/AUTH-DEV-SERVER-01`; task worktree contains tracked edits to README, task breakdown, Tauri dev config and website README plus untracked `scripts/tauri-dev.mjs`.
- The existing checkout at `C:\Users\kaya\Desktop\Hydra\soravo` remains on `feature/desktop-auth-onboarding` with user modifications and untracked E2E files; it was not edited or cleaned by this task.
- Ignored test setup in task worktree: node_modules junctions to existing dependencies and `website/.env.local` with public Vite Supabase config only; no E2E credentials were copied. These are not staged or committed.
- Port 5173 was already listening on `::1` under PID 4520 before task test setup. The first route smoke reused the existing desktop Vite server, which was later found to be from the user checkout, so it did not validate the callback. Task website Vite PID 6316 was stopped after that finding. Windows denied stopping existing PID 4520; the Soravo app PID 3052 remains open and uses a debug executable registered from the older controlled-cleanup worktree. The owner needs to close these old dev processes before the same-worktree Tauri test can start.
- Free disk at worktree creation was approximately 3.0 GB; no separate Rust target or Rust build was created. `git diff --check` passed. No branch integration, push, deploy or external service mutation occurred.

### Follow-up — same-worktree launch — 2026-11-02

- Owner stopped the prior app and dev servers. Ports 5173 and 5174 were free before launch. The task launcher now refuses to proceed if desktop Vite already occupies 5173.
- Rust build diagnosis: the ambient setup initially selected GNU and failed linking (`export ordinal too large`). MSVC compilation then used mixed toolchain artifacts. Loading VS 2017 `vcvars64.bat`, pinning `RUSTC` to installed 1.90 MSVC, setting `CARGO_BUILD_TARGET=x86_64-pc-windows-msvc`, and using an isolated target directory resolved `cargo check --locked`. `cargo test --lib --locked` passed 38/38; a full Cargo test pass is not claimed.
- `npm run tauri:dev` is running from this task worktree. Soravo process PID 7836 runs from the isolated target directory. The app logged successful development deep-link registration; `HKCU\\Software\\Classes\\soravo\\shell\\open\\command` points to that exact executable. Port 5173 (desktop) and 5174 (website) both respond; `/auth/desktop` returns HTTP 200.
- UI automation can inspect the desktop sign-in window, but screen capture failed and accessibility click geometry is unavailable. The app is left open at sign-in for the owner to complete the browser-to-app round-trip. No test credentials were copied; task worktree ignored `.env.local` has only public Vite config. Existing main checkout remains untouched.
- Tracked changes remain uncommitted in `fix/AUTH-DEV-SERVER-01`; no push, merge, deploy, or production service mutation occurred.

### Owner E2E confirmation — 2026-11-02

- Owner tested the running task-worktree app: Sign in opened the website, authentication completed, and Open Soravo returned the signed-in state to the desktop app. This satisfies the end-to-end acceptance check; no disposable credentials were handled by the agent.
- Runtime commits `0bc0a64` and `17dddcb` were squash-merged through PR #42 as `9fa4c130589eba83b87f5ea59caf69859f35c2a1`. CodeRabbit identified that Linux release startup must continue after a deep-link registration error; the locked plugin source confirmed that registration can fail while writing the desktop handler. The code now makes the error fatal in debug builds and logs/continues in Linux release. CodeRabbit, engineering-pack, Windows packaging, and Linux packaging checks passed.
- Documentation changes remain in the task worktree for a separate docs branch. No deployment or production service mutation occurred.
