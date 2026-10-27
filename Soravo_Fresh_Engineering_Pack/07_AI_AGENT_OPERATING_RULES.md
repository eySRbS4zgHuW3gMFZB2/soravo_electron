# AI Agent Operating Rules

These rules apply to OpenCode, coding agents, CLI agents and future sessions.

## Session start — mandatory
1. Read this file, `00_README.md`, `01_AUTHORITY_AND_SOURCE_OF_TRUTH.md`, the owner-approved decision memo `SORAVO_DECISION_MEMO_2026-10-22.md`, `28_GIT_WORKTREE_POLICY.md`, `18_PROGRESS_AND_HANDOFF.md`, `19_STATE_AUDIT_PROTOCOL.md`, `15_ADR_INDEX.md`, and the task-specific documents.
2. Inspect actual git remote, branch, status and latest commit.
3. Inspect current source files and relevant tests. Never assume prior chat state is current.
4. Check current CI and uncommitted user changes before editing.
5. Do not ask the owner to perform developer-only tasks if an agent with available tools can safely do them; do ask before irreversible or account/security actions.

## Skill selection gate — mandatory


Before any substantive task is planned or implemented, select and load the skills that bear on it. This is a gate, not a suggestion: no substantive task may be planned or implemented until it has run and the mandatory skills are loaded.

1. **Match the task to domains.** Read the skill matrix in `08_SKILLS_AND_MCP_POLICY.md` and identify the skills relevant to the task's domains (Rust, Tauri, Supabase, Cloudflare, shadcn, Playwright, security review, CodeRabbit, etc.).
2. **Load the skill's current instructions** (`SKILL.md` under `../.agents/skills/<id>/`) and follow them. A skill you have not read is not a skill you have applied.
3. **Use the MCP/CLI tool only if it materially helps.** Tool use must add evidence or perform a needed operation. Do not invoke every tool on every task.
4. **Record the selection** in the task's notes: which skills were loaded, which were considered but not loaded, and why. If a skill file is unavailable, say so and use documented best practices without claiming the skill was applied.

Skills are installed one level above this repository, at `../.agents/skills/`. They are outside the repository and are not tracked by Git. Never commit them, never move them into the repo, and never assume they are present on another machine without checking.

Skills are knowledge; a subagent is a worker. Use a skill when the work needs the knowledge it encodes. Use a subagent when the work is independent, well-scoped and can run in parallel with the main agent's work. The two are not interchangeable.

## Subagent-first orchestration — mandatory

When a task has independent, well-scoped parts, delegate them to subagents rather than doing everything in the main agent. This is the default for multi-part work, not an exception.

- **When to delegate:** independent research, audits or reads that can run in parallel with the main agent's edits; a second opinion on a non-trivial design or diff; verification work that does not block the next editing step; anything where the main agent would otherwise be idle waiting.
- **When NOT to delegate:** the task is small, sequential, or depends on context only the main agent holds; the work is destructive or irreversible (renames, deletions, production changes, secret handling) — the main agent owns those, always; two agents would need to touch the same files.
- **Isolation:** each subagent gets its own worktree or at least its own directory scope. A subagent never writes into a worktree it does not own. Subagent output is evidence, not authority — the main agent integrates, resolves conflicts, runs the tests and reviews the diff before accepting anything. A subagent's report that a change works is not a passing test.
- **Before integration:** the main agent re-reads every file the subagent changed, runs the relevant tests itself, and inspects the diff for accidental changes and secrets. A subagent that edited a file outside its scope is a blocker, not a detail.
- **CodeRabbit and subagents:** subagent-driven changes are reviewed by CodeRabbit on the integrated diff, not on each subagent's output. A CodeRabbit finding that traces to a subagent's work is triaged by the main agent, and the subagent is re-run if the fix is non-trivial.

5. **State the task, scope, files expected to change, risks and verification plan in a concise plan.** This comes after the skill selection gate: the gate must have run before any substantive planning, because the skills may change what you plan.

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
- Never run destructive commands, reset/clean a repo, delete branches, rotate secrets, change repo visibility, rename repos or deploy production without explicit owner approval. The one exception is the task branch cleanup that `28_GIT_WORKTREE_POLICY.md` requires: **deleting a merged task branch and its worktree is expected work, not a destructive action.** The prohibition still applies to unmerged branches, to branches belonging to another task, and to any branch whose work is not yet merged and pushed.
- **Never retire, redirect or repoint `soravo.xyz`, change DNS, or alter Cloudflare production settings without explicit owner approval.** The production site stays as it is until the replacement passes its launch checklist; cutover is a separate approved step (`27_PRODUCTION_CUTOVER_AND_ROLLBACK.md`).
- **Do not implement against a `PROPOSED` ADR.** ADR-0003 is ACCEPTED for Supabase Edge Functions. ADR-0010 (engine bundled layout) remains PROPOSED and must be made ACCEPTED with a rationale before implementation. ADR-0005 (binary host) is accepted, with clean-machine verification, the Linux release gate when publishing Linux artifacts, and owner approval still required.
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
