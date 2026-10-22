# Definition of Done (DoD) and QA Gates

A task is done only when every applicable checkbox is satisfied.

## General
- [ ] Requirement and acceptance criteria met.
- [ ] Work was done in a dedicated Git worktree and named branch, per `28_GIT_WORKTREE_POLICY.md`.
- [ ] Worktree path, branch and base SHA recorded in the progress record.
- [ ] No other worktree's files, branch, index or stash were modified.
- [ ] Diff reviewed for unrelated changes.
- [ ] No user changes overwritten.
- [ ] Tests run in the worktree and actual results recorded.
- [ ] Review performed on the worktree's diff; findings triaged.
- [ ] Docs, progress and handoff updated.
- [ ] No secrets or personal data added.
- [ ] Relevant skill loaded/applied.
- [ ] CodeRabbit review run for substantive change when quota permits; findings triaged.
- [ ] CI passes or explicit exception approved and documented.
- [ ] After integration: worktree removed, registration pruned, merged local branch deleted, and the worktree's build output deleted.

## Website
- [ ] Typecheck/build passes.
- [ ] E2E test for changed path passes.
- [ ] Keyboard and responsive checks pass.
- [ ] Auth errors and loading states are clear.
- [ ] Preview deploy uses staging only.
- [ ] No secrets in built files or source maps.

## Supabase
- [ ] Migration replay works from clean database.
- [ ] RLS enabled and positive/negative tests pass.
- [ ] Admin role cannot be set by a normal user.
- [ ] Service secrets remain server-side.
- [ ] Logs contain no tokens or sensitive payloads.

## Payments
- [ ] Signature verification tests pass.
- [ ] Duplicate event is idempotent.
- [ ] Browser redirect alone grants no entitlement.
- [ ] Amount/currency/plan are verified server-side.
- [ ] Refund/cancellation/failed-renewal states tested.
- [ ] Test-mode owner walkthrough recorded.

## Desktop licensing
- [ ] Browser callback uses one-time code, no token URL.
- [ ] Credentials stored in OS secure storage.
- [ ] Monthly device limit and 14-day grace tested.
- [ ] Lifetime unlimited devices and indefinite offline behavior tested.
- [ ] Entitlement logic not renderer-only.
- [ ] Expiry does not delete local user data.
- [ ] Core dictation regression test passes.

## Release
- [ ] Clean Windows install and dictation verified on a machine with no developer tools and no source tree.
- [ ] Clean Linux install and dictation verified.
- [ ] CrispASR binary and all dependencies included, sourced from a git-tracked path.
- [ ] The bundled engine layout is recorded in ADR-0010 and that ADR is ACCEPTED.
- [ ] The app launches the bundled engine with no developer-only fetch step (`npm run fetch:asr`) and no source tree present.
- [ ] SHA-256 checksums generated and independently verified.
- [ ] Download links work logged out.
- [ ] Security warnings described honestly.
- [ ] Release tag/commit/artifact hashes recorded.
- [ ] Owner approved release.

## Production cutover
- [ ] URL inventory complete; every path classified as Preserve, Redirect, Retire or Block, with owner approval for Retire and Block.
- [ ] Redirects configured and each tested from a logged-out browser.
- [ ] Restorable production data snapshot taken and recorded as the rollback target.
- [ ] Rollback procedure rehearsed, at least as a dry run.
- [ ] Previous production deployment still reachable and identifiable.
- [ ] Business email verified delivering after any DNS-related change.
- [ ] `27_PRODUCTION_CUTOVER_AND_ROLLBACK.md` prerequisites all evidenced.
- [ ] Owner has given explicit approval for the cutover window, separately from release approval.
