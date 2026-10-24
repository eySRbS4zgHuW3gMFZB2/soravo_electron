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

## Bounded review-fix audit — 2026-10-24

- CONFIRMED at `1ae7c4c402d11ee2f9f41dea9c2c5c88299a3aa3`: isolated assigned task checkout/branch, initially clean, sole registered worktree. Latest remote Website CI, CI and Packaging baseline runs succeeded; these results precede this patch.
- CONFIRMED: all four supplied auth/signup/device diagnostics findings were still present and repaired with no payment, entitlement, authorization or response contract changes.
- CONFIRMED: Node v24.21.0, npm 11.19.0; website lockfile dependencies installed successfully. Deno is unavailable, so device-handler behavior is checked through a temporary Node harness executing the transpiled function with synthetic Deno/Supabase fixtures; deployment/runtime compatibility remains unverified.
- No provider configuration, data or production state inspected or changed. Current patch validation is recorded in `workspace-context/validation-record.md` outside the repository; completion results are appended to the session handoff.
