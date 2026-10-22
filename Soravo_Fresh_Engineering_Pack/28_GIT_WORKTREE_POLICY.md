# Git Worktree Policy — Mandatory

**Status:** Binding. Supersedes any looser practice.  
**Authority:** Owner instruction, 2026-10-22. Applies to every agent, human contributor and automated tool that changes files in this repository.  
**Related:** `07_AI_AGENT_OPERATING_RULES.md`, `06_TASK_BREAKDOWN.md`, `05_IMPLEMENTATION_PLAN.md`, `17_DEFINITION_OF_DONE.md`, `19_STATE_AUDIT_PROTOCOL.md`, `09_GITHUB_CI_POLICY.md`.

## Purpose

Every new feature or independent task gets its own dedicated Git worktree and its own branch. Tasks stay isolated from each other. No task may ever overwrite, disturb or silently absorb another task's changes. Nothing is integrated until it has passed tests and review.

This exists because the failure mode it prevents is quiet. Two agents editing the same working tree produce a diff that belongs to neither of them, and the resulting bug is attributed to the wrong change.

## When a worktree is mandatory

A dedicated worktree and branch are required for:

- any new feature;
- any independent task, however small, that is not part of a larger in-flight change;
- any task that touches application source, database migrations, CI workflows, packaging configuration or release configuration;
- any task expected to span more than one session or agent context;
- any task that runs in parallel with another task;
- any task that will produce a commit.

## When a worktree is not required

- Reading, auditing or researching. No writes, no branch, no worktree.
- Applying a single, already-reviewed change that the owner explicitly asks to be made in place on `main`.
- Purely conversational work.

**Exceptions are not silent.** If a task is completed without a worktree where one was required, the progress record must state why, and the owner must approve the exception. A missing worktree is a reportable deviation, not a detail.

## The rules

1. **One task, one worktree, one branch.** A worktree is used by exactly one task at a time.
2. **Create the worktree from a known-good base** — normally the current `origin/main`, never a branch with uncommitted work.
3. **Always create the worktree with an explicit named branch.** A worktree left on a detached HEAD is a defect: if the branch it was made from is deleted, the work becomes reachable only through the reflog and is easily lost. This repository currently holds worktrees on detached HEADs; that is the pattern this rule exists to end.
4. **All edits for the task happen inside the worktree.** The main working tree is not edited during a worktree task.
5. **Never touch another worktree's files, branch, index or stash.** Worktrees share one repository's object store and refs; the isolation is of the working tree, not of the history.
6. **Never force-push, reset, rebase or delete a branch that another worktree holds.** Git will refuse most of these; where it does not, the agent must not do it.
7. **Tests must pass in the worktree before integration.** A task that cannot demonstrate passing tests is not ready to merge.
8. **Review must happen on the worktree's diff** before integration, and findings must be triaged rather than blindly applied.
9. **Integrate, then remove the worktree.** Do not leave worktrees to accumulate.
10. **Record the worktree path and branch in the progress record** for the task.

## Layout and naming

**Location.** All worktrees live under `.worktrees/<task-id>-<slug>` in the repository root. `.worktrees/` is already git-ignored, so a worktree directory can never be committed by accident.

**Branch.** `<type>/<task-id>-<slug>`, where `<type>` is one of `feature`, `fix`, `docs`, `chore` — matching the repository's existing branch convention, under which `main` stays linear and each piece of work merges as its own commit.

**Task ID.** Use the breakdown IDs from `06_TASK_BREAKDOWN.md` (`P0-01`, `P1-03`, `P2-08`, and so on). A worktree without a task ID has no defined scope and cannot be reviewed.

**Example.**

```
git fetch origin
git worktree add --no-track .worktrees/P1-03-engine-packaging -b feature/P1-03-engine-packaging origin/main
```

`--no-track` matters. Without it, git sets the new branch's upstream to `origin/main`, so a later bare `git push` can target `main` instead of the task branch. The upstream is set deliberately, to the task branch, at push time:

```
git push -u origin feature/P1-03-engine-packaging
```

Always name the task branch explicitly when pushing.

## Lifecycle

### 1. Create
- Confirm the main working tree is clean apart from the task's own starting material, and record `git status` and the base SHA.
- Create the worktree and branch from `origin/main`.
- Record the worktree path and branch in the task's progress entry.

### 2. Implement
- Work only inside the worktree.
- Keep the change scoped to the task. Unrelated improvements go to a separate task with their own worktree.
- Do not modify the desktop app's package manager, lockfile or dependency versions unless the task is explicitly about them.

### 3. Verify
- Run the targeted tests for the changed area, then the relevant full checks.
- Record the commands actually run and their actual output. A test that was not run is not a passing test.
- If the task touches the desktop app, the Rust build and tests must pass, and the app must be launched and driven if the change is user-visible.

### 4. Review
- Review the diff for accidental changes, secrets and unrelated edits.
- Run CodeRabbit review on the worktree's diff where quota permits, and triage the findings.
- Security-sensitive changes get an explicit security review.

### 5. Integrate
- Push the branch, open the pull request, and integrate only when required checks pass and the review is clean.
- The main working tree is the integration point. Merge `main` only from a clean tree.
- Record the merge commit SHA in the progress record.

### 6. Clean up
- Remove the worktree: `git worktree remove <path>` (add `--force` only if the tree is genuinely clean of uncommitted work and that is recorded).
- `git worktree prune` to clear registrations left by a directory deleted out from under git.
- Delete the local branch once it is merged and pushed.
- **Remove the worktree's build output as well.** A Rust worktree carries its own `src-tauri/target` directory, typically several gigabytes. A directory removed without its build output leaves the disk cost behind.

## What git already guarantees

These were verified against the installed git (2.56.0) and are relied upon, not re-implemented:

- A branch already checked out in one worktree **cannot** be checked out in another. Git refuses with *"already used by worktree at …"*.
- A branch held by a worktree **cannot** be deleted. Git refuses with *"cannot delete branch … used by worktree at …"*.
- The main working tree **cannot** switch to a branch another worktree holds.
- A worktree directory deleted outside git leaves a `prunable` registration, which `git worktree prune` removes.

These guarantees protect the *branch*. They do not protect the working files, the stash, the config or the object store. Those are the agent's responsibility.

## Shared-repository hazards

Worktrees share one repository. The following are **repository-wide**, not per-worktree, and an agent working in one worktree can disturb another without any error:

- **`git stash`** — the stash is shared by every worktree. Stashing in one worktree removes changes another worktree may depend on, and the other worktree sees a stash entry it did not create. Prefer committing over stashing. If stashing is unavoidable, record the stash reference in the progress record and restore it in the same task.
- **Tags, notes and other refs** are shared.
- **Repository configuration** (`git config`, local hooks) is shared.
- **The object store and `git gc`** are shared; a `gc` in one worktree can pack objects another worktree is relying on.
- **`git worktree prune`** from one worktree affects registrations for all of them.

## Build caches and disk

Each worktree is a full checkout and, unless `CARGO_TARGET_DIR` is set explicitly, gets **its own** `src-tauri/target` directory. A debug build of this project is several gigabytes. Four parallel worktrees can therefore consume tens of gigabytes.

- Before creating a worktree that will build the desktop app, **check free disk space**. This is not theoretical: a worktree set on this repository previously consumed roughly 29 GB of build output alone.
- Set `CARGO_TARGET_DIR` explicitly per worktree to a known location when sharing is intended, and be aware that a shared target directory causes rebuild churn when branches differ.
- Removing a worktree must include its build output.
- Record disk state in the state audit.

## Recovery

**Worktree directory deleted but the registration remains.** `git worktree list` shows the entry marked `prunable`. Run `git worktree prune` to clear it. Do not hand-edit `.git/worktrees`.

**Work was on a detached HEAD.** Recover the commit SHA from the worktree's `git log` before removing anything, then create a branch at that SHA immediately: `git branch rescue/<name> <sha>`. Detached-HEAD work is recoverable from the reflog, but only until the reflog expires or the object is pruned.

**A branch was deleted while a worktree held it.** Git refuses this, but a force-deleted branch outside git is recoverable through `git reflog` on the repository.

**Worktree registration points at a missing directory.** `git worktree prune`. Nothing else is lost — the branch and its commits are unaffected.

**Disk pressure from worktrees.** List them with `git worktree list`, measure each, and remove the finished ones. Report the state before deleting anything; a worktree may hold uncommitted work that exists nowhere else.

## Evidence required before integration

A task is ready to integrate only when all of the following are recorded:

- the worktree path and branch;
- the base SHA the branch was created from;
- the exact commands run and their actual output;
- the review performed and how findings were triaged;
- confirmation that the change is scoped to the task and contains no secrets;
- the merge commit SHA, after integration.

## Audit

`19_STATE_AUDIT_PROTOCOL.md` records the worktree list as part of the standard state audit: path, branch, base SHA, uncommitted files, upstream tracking, and build-output size. Any worktree on a detached HEAD is reported as a defect.

## Exceptions

The owner may approve an exception. An approved exception is recorded in `18_PROGRESS_AND_HANDOFF.md` with the reason, the scope it covers, and the compensating check that was performed instead.
