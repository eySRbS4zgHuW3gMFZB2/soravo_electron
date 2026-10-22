# AI Agent Operating Rules

These rules apply to OpenCode, coding agents, CLI agents and future sessions.

## Session start — mandatory
1. Read this file, `00_README.md`, `01_AUTHORITY_AND_SOURCE_OF_TRUTH.md`, the owner-approved decision memo `SORAVO_DECISION_MEMO_2026-10-22.md`, `28_GIT_WORKTREE_POLICY.md`, `18_PROGRESS_AND_HANDOFF.md`, `19_STATE_AUDIT_PROTOCOL.md`, `15_ADR_INDEX.md`, and the task-specific documents.
2. Inspect actual git remote, branch, status and latest commit.
3. Inspect current source files and relevant tests. Never assume prior chat state is current.
4. Check current CI and uncommitted user changes before editing.
5. State the task, scope, files expected to change, risks and verification plan in a concise plan.
6. Do not ask the owner to perform developer-only tasks if an agent with available tools can safely do them; do ask before irreversible or account/security actions.

## Worktrees — mandatory
**Read `28_GIT_WORKTREE_POLICY.md` before changing any file.** It is binding, not advisory.

- Every new feature and every independent task gets **its own dedicated worktree and branch**. One task, one worktree, one branch.
- A worktree is created with an **explicit named branch**. Never leave a worktree on a detached HEAD; that is how work gets lost.
- All edits for a task happen **inside** that worktree. The main working tree is not edited during a worktree task.
- Never touch another worktree's files, branch, index or stash. The stash is **repository-wide** and shared by every worktree — prefer committing over stashing.
- Tests and review happen in the worktree, on the worktree's diff, before anything is integrated.
- After merging, remove the worktree, `git worktree prune`, delete the merged local branch, and **delete the worktree's build output** — a Rust worktree carries its own multi-gigabyte `src-tauri/target`.
- Record the worktree path, branch and base SHA in the progress record.
- A task completed without a worktree where one was required is a reportable deviation and needs the owner's recorded approval.

## Scope and safety
- Never modify old `soravo_deprecated` as part of current implementation.
- Do not port old code, schemas, migrations or workflows. The historical repository is a **behavioral and content reference only** for approved website content and behavior.
- Do not redesign the desktop UI or replace CrispASR under this commercial-release scope.
- Never run destructive commands, reset/clean a repo, delete branches, rotate secrets, change repo visibility, rename repos or deploy production without explicit owner approval.
- **Never retire, redirect or repoint `soravo.xyz`, change DNS, or alter Cloudflare production settings without explicit owner approval.** The production site stays as it is until the replacement passes its launch checklist; cutover is a separate approved step (`27_PRODUCTION_CUTOVER_AND_ROLLBACK.md`).
- **Do not implement against a `PROPOSED` ADR.** ADR-0003 (backend placement), ADR-0005 (binary host) and ADR-0010 (engine bundled layout) are open; each must be made ACCEPTED with a rationale first.
- Preserve user edits. Never overwrite unknown uncommitted changes.
- Use feature branches and small PRs; avoid direct commits to protected main once protection is enabled.
- Keep tasks small enough to survive a context/usage cutoff.
- Do not claim tests passed unless they actually ran and outputs were checked.
- If blocked, stop at a safe checkpoint, document exactly what remains, and avoid speculative edits.

## Required task loop
1. Establish current state.
2. Read applicable requirements, TDD, security baseline and ADRs.
3. **Create the task's worktree and branch** per `28_GIT_WORKTREE_POLICY.md`, and record the path, branch and base SHA.
4. Implement the smallest complete slice, inside the worktree.
5. Run targeted tests, then relevant full checks.
6. Inspect the diff for accidental changes and secrets.
7. Run CodeRabbit review on the diff when practical and within quota; fix valid findings, explain false positives.
8. Update docs, progress, state audit and handoff.
9. Integrate through a pull request, then remove the worktree and its build output per the policy.
10. Report changed files, tests, unresolved risks and next action.

## Code quality
- Prefer typed, explicit contracts and schema validation at boundaries.
- Validate untrusted user input, deep links, webhooks, API payloads and environment configuration.
- No `any` to silence a meaningful type issue without a written justification.
- No secrets in source, test fixtures, screenshots, generated artifacts or logs.
- Do not disable tests, lint, typecheck, CSP or security checks to make a build green.
- Pin action versions and third-party tool versions where feasible.
- Avoid unrelated dependency upgrades.
- Use migrations for schema changes; never mutate production schema manually without a migration.
- Make webhook processing idempotent.
- All privileged server operations must re-authorize on every request.

## Completion report format
- Outcome: done/partial/blocked.
- Summary of behavior changed.
- Worktree path, branch and base SHA; whether the worktree was removed.
- Files changed.
- Commands/tests actually run and result.
- CI and CodeRabbit result.
- Security/privacy considerations.
- Known limitations and decisions needed.
- Exact next action.
- Update `18_PROGRESS_AND_HANDOFF.md` before ending.
