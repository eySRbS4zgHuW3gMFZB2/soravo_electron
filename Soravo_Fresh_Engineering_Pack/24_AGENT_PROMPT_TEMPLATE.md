# Task Prompt Template for OpenCode

Use this template for each task; fill it with a single scoped task ID.

---

You are working on Soravo, the current Tauri v2 desktop product. Read the required engineering pack documents before editing.

**Task ID:** [e.g. P2-03]  
**Goal:** [one observable outcome]  
**Worktree:** [path and branch to create, per `28_GIT_WORKTREE_POLICY.md` — one task, one worktree, one named branch; never a detached HEAD]  
**In scope:** [specific files/module/behavior]  
**Out of scope:** [what must not change]  
**Acceptance criteria:** [measurable list]  
**Required skill(s):** [load relevant installed skill instructions]  
**MCP/tools:** [only tools that materially help; inspect before mutating]  
**Tests:** [exact tests and commands]  
**Security/privacy risks:** [auth, secrets, payment, RLS, etc.]  
**Rollback:** [how to revert safely]

Rules:
- Inspect current source and git status first.
- **Create and work inside this task's dedicated worktree and branch. Do not edit the main working tree. Do not touch another worktree's files, branch, index or stash — the stash is shared repository-wide.**
- Run tests and report actual outputs, in the worktree, before integrating.
- Do not copy anything from `soravo_deprecated`.
- Do not replace CrispASR or rebuild desktop UI under this task.
- Preserve uncommitted user changes.
- Do not deploy, rename repositories, change visibility, or alter production data without explicit approval.
- Update `18_PROGRESS_AND_HANDOFF.md`, `19_STATE_AUDIT_PROTOCOL.md` if state changed, and any relevant ADR.
- If blocked, stop safely and record exact blocker instead of guessing.

Return a concise completion report with the worktree path and branch, changed files, tests, CI/CodeRabbit results, risks, decisions, and next task.
