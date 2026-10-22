# Progress and Handoff — Mandatory Living Record

**Last updated:** 2026-10-22 (decision memo applied to the pack; implementation still not started)  
**Current status:** Planning pack reconciled against the owner-approved decision memo. Documentation-only changes. No repository, account, service or VM mutations performed.

## Owner-approved decisions
- Launch Windows + Linux.
- Preserve current Tauri app and CrispASR.
- Website under `website/`, independent package/lockfile.
- Cloudflare Pages; Supabase Auth/Postgres; Resend custom SMTP; Razorpay.
- Monthly $12 recurring, 3 active devices, 14-day offline grace.
- Lifetime $50, unlimited devices, indefinite offline after activation.
- Enterprise deferred.
- Browser-based app sign-in.
- Cloudflare Web Analytics for site visitors.
- Admin via Supabase Auth plus server-side role checks.
- Subscription lapse: grace then paid features disabled; local data retained/exportable.
- Prefer GitHub Actions extensively while repo is public.
- Need free binary-hosting options; separate public releases repo is default recommendation, not final if owner rejects public repo hosting.
- Rename old repo `soravo` to `soravo_deprecated`; active repo `soravo_electron` to `soravo`; local folder to `soravo`.
- Do not copy code/schema/spec implementation from old repo.

## Decisions approved in the 2026-10-22 memo (highest authority in this pack)
- **Website: rebuild fresh; preserve the current site until cutover.** The historical repository is a behavioral/content reference only for approved website content and behavior; its implementation, schema, migrations, Edge Functions and Handy-derived desktop code are not ported. `soravo.xyz` and its DNS/email configuration stay untouched until the replacement passes its launch checklist. Recorded as ADR-0008 and `27_PRODUCTION_CUTOVER_AND_ROLLBACK.md`.
- **Repository rename: CI first.** Order is backup/audit → baseline CI and release-packaging checks → rename checklist → rename → post-rename verification. Recorded as ADR-0009, and in `05_IMPLEMENTATION_PLAN.md` Phase 0, `06_TASK_BREAKDOWN.md` P0 and `21_RENAME_AND_MIGRATION_RUNBOOK.md`.
- **Production domain: preserved through the migration.** Cutover is a separate, explicitly approved, reversible step with a URL inventory, tested redirects and a rehearsed rollback. Recorded in `27_PRODUCTION_CUTOVER_AND_ROLLBACK.md`, Phase 8 and tasks P3-09/P8-09/P8-10.
- **CrispASR packaging finding corrected** in `23_SOURCE_AUDIT_NOTES.md`; the bundled layout is now ADR-0010 (PROPOSED) and a clean-machine install proving engine launch is an explicit release blocker.
- **ADR/TDD consistency:** ADR-0003, ADR-0005 and the new ADR-0010 are explicitly PROPOSED and must not be implemented as settled.
- **Git worktree policy is mandatory** (owner instruction, 2026-10-22): every new feature and every independent task runs in its own dedicated worktree and named branch; one task, one worktree, one branch; tasks never touch another worktree's files, branch, index or stash; tests and review happen in the worktree before integration; after merging, the worktree, its registration and its build output are removed. Recorded as `28_GIT_WORKTREE_POLICY.md`.

## Verified in the 2026-10-22 worktree-policy session
- Installed git is **2.56.0**; `.worktrees/` is already git-ignored in the active repository, so a worktree directory cannot be committed by accident.
- The active repository currently holds **three registered worktrees**: `settings-system` and `snippets-scratchpad` are on **detached HEAD**, and `wispr-redesign` is on `feature/wispr-redesign`. Detached-HEAD worktrees are exactly the pattern the new policy ends.
- The git safety guarantees the policy relies on were **verified empirically** against a throwaway repository, not assumed:
  - a branch already checked out in one worktree **cannot** be checked out in another — *"already used by worktree at …"*;
  - a branch held by a worktree **cannot** be deleted — *"cannot delete branch … used by worktree at …"*;
  - the main working tree **cannot** switch to a branch another worktree holds;
  - a worktree directory deleted outside git leaves a `prunable` registration, cleared by `git worktree prune`.
- **The stash is repository-wide, not per-worktree.** Verified: a stash created in one worktree is visible from another. This is recorded as a shared-repository hazard in the policy, with "prefer committing over stashing" as the rule.
- `git worktree prune --dry-run` currently reports no stale registrations.
- **Each worktree gets its own `src-tauri/target`** unless `CARGO_TARGET_DIR` is set, and it is not set anywhere in the repository. The main tree's target is ~7.2 GB; three worktrees previously held roughly 29 GB of build output between them. The policy therefore requires a disk check before creating a Rust worktree and requires the build output to be deleted with the worktree.

## Source-checked facts
- Active remote observed: `eySRbS4zgHuW3gMFZB2/soravo_electron`, public at audit time.
- `package.json` name is already `soravo`.
- App is Tauri v2 + Rust + React + TypeScript + Vite.
- Current README/progress have inconsistent historical descriptions around Whisper/CrispASR; current owner decision is preserve CrispASR.
- `src-tauri/tauri.conf.json` shows `resources: []`, `externalBin: []`; packaging must be repaired. The tracked engine path is `third-party/crispasr/extracted/crispasr-windows-x86_64-cpu/`, not `third-party/bin/`.
- Current Tauri config showed CSP `null`; must establish restrictive CSP before commercial network/auth flows.
- Windows is most clearly documented; Linux is a launch target but needs real build/install/runtime proof.
- The source repo was public at the time of inspection.
- Website/auth/payment/dashboard are new work in this active repo.

## Verified in the 2026-10-22 reconciliation session
- Audit of the active repository: `main` at `3ac4e3e`, clean working tree except the untracked pack folder, remote `soravo_electron`, eight local branches all with remote counterparts, three registered worktrees.
- **CrispASR engine locations confirmed against the checkout:** `third-party/bin/` is git-ignored with **0 tracked files** (40 files exist only on a developer machine, from `npm run fetch:asr`); the engine is **committed** at `third-party/crispasr/extracted/crispasr-windows-x86_64-cpu/` (`crispasr.exe` 18.3 MB, `openblas.dll` 1.7 MB, `crispasr-quantize.exe` 0.6 MB, LICENSE, THIRD_PARTY_NOTICES.txt); `third-party/crispasr/crispasr.zip` (8.7 MB) is also committed.
- `find_crispasr_binary` in `src-tauri/src/lib.rs` searches `<root>/third-party/bin/<exe>` then the children of `<root>/third-party/crispasr/extracted/`, over roots `current_dir`, `project_root` and the Tauri `resource_dir`. None of the first two exist on an installed machine, and `resource_dir` holds no engine.
- A release build was produced for inspection: `Soravo_0.1.0_x64_en-US.msi` (~6.15 MB) and `Soravo_0.1.0_x64-setup.exe` (~4.28 MB), both far smaller than the ~20 MB engine — corroborating that the engine is not bundled.
- The historical repository `soravo` currently holds the live production deployment: its `homepage` is `soravo.xyz`, and the Cloudflare Pages project `soravo` was last deployed from that repository's commit `33d3d4c`. The Pages project is deployed by **direct upload**, not by Cloudflare's Git integration, so a repository rename does not by itself break the deployed site. Recorded as planning context only.
- The historical repository's Supabase project is observed as **paused** (`status: INACTIVE`), reinforcing that it must not be treated as a live dependency.
- `soravo_deprecated` is confirmed available as a repository name.

## Changes made this session
Documentation only, all inside `Soravo_Fresh_Engineering_Pack/`:

- `00_README.md` — memo decisions added; new "Decisions still open" section; corrected engine-packaging baseline; production-site context; worktree policy added to the read order and to a new "Mandatory policies" section.
- `01_AUTHORITY_AND_SOURCE_OF_TRUTH.md` — memo named as highest authority; old-repository boundary clarified as behavioral/content reference only; rename ordering fixed to CI-first.
- `02_PRODUCT_REQUIREMENTS.md` — website section states fresh build per ADR-0008 and production-site preservation.
- `04_TECHNICAL_DESIGN.md` — new "Engine packaging (blocking)" section; backend placement softened to PROPOSED with ADR-0003 pointer; new "Website rebuild strategy" section.
- `05_IMPLEMENTATION_PLAN.md` — Phase 0 reordered (CI before rename, production untouched); Phase 1 packaging and clean-install gate; Phase 2 ADR-0003 decision task; Phase 3 fresh-build and production-untouched; Phase 8 ADR-0005 gate and cutover; new "Task discipline" section binding every task to a worktree.
- `06_TASK_BREAKDOWN.md` — P0 reordered and expanded (P0-01..P0-09); P1 corrected for the real engine path, ADR-0010 and the clean-machine gate (P1-01..P1-08); P2-08 backend decision and P2-09 DNS/email record added; P3-01 fresh build and P3-09 URL inventory added; P8-00 host gate, P8-09 cutover preparation and P8-10 cutover added; worktree and branch naming added to the header and to the per-task checklist.
- `07_AI_AGENT_OPERATING_RULES.md` — memo added to the mandatory session-start reading list; PROPOSED-ADR rule and production-cutover prohibition added; new "Worktrees — mandatory" section; worktree creation added to the required task loop; worktree details added to the completion report.
- `09_GITHUB_CI_POLICY.md` — CI-before-rename rule; release workflow must inspect the artifact for the engine; production hostname must not be a CI target; task-ID branch convention tied to worktrees.
- `12_TEST_AND_BENCHMARK_PROTOCOL.md` — clean-machine engine-launch case and production-unchanged case added.
- `13_RELEASE_RUNBOOK.md` — ADR-0005 publish gate; clean-install requirement; separate website-cutover rollback pointer.
- `15_ADR_INDEX.md` — ADR-0003/0005 statuses made unambiguous; ADR-0006 ordering constraint; new ADR-0008, ADR-0009, ADR-0010.
- `16_PRIVACY_LEGAL_LAUNCH_CHECKLIST.md` — production-cutover checklist added.
- `17_DEFINITION_OF_DONE.md` — clean-machine engine gate and cutover items added; general section now requires a dedicated worktree, isolation from other worktrees, review on the worktree diff, and post-integration worktree and build-output cleanup.
- `18_PROGRESS_AND_HANDOFF.md` — this file.
- `19_STATE_AUDIT_PROTOCOL.md` — audit-finding reconfirmation step added; worktree list added to the standard audit with a dedicated worktree audit section; `git worktree list` added to the safe commands.
- `21_RENAME_AND_MIGRATION_RUNBOOK.md` — CI-first precondition and post-rename verification checklist added.
- `23_SOURCE_AUDIT_NOTES.md` — finding 3 corrected with the verified paths; "later verification notes" section added.
- `24_AGENT_PROMPT_TEMPLATE.md` — worktree field, worktree rules, tests-in-worktree and worktree reporting added.
- `26_MANIFEST.json` — version 1.2.0, new file, memo decisions, open decisions, mandatory-policies block, corrected note.
- `27_PRODUCTION_CUTOVER_AND_ROLLBACK.md` — **new document**.
- `28_GIT_WORKTREE_POLICY.md` — **new document**.
- `INDEX.md` — new documents and the memo indexed; memo declared highest authority.

Total: 20 files modified, 2 files added. The owner-supplied `SORAVO_DECISION_MEMO_2026-10-22.md` was **not modified** — verified byte-identical by SHA-256 against the pre-edit backup. Eight further documents were correctly left untouched because neither the memo nor the worktree policy required changes to them: `03_COMMERCIAL_RULES.md`, `08_SKILLS_AND_MCP_POLICY.md`, `10_SECURITY_BASELINE.md`, `11_ENVIRONMENT_AND_SECRETS.md`, `14_FREE_BINARY_HOSTING_OPTIONS.md`, `20_SERVICE_LIMITS_AND_MONITORING.md`, `22_REVERSE_ENGINEERING_AND_PROVENANCE.md`, `25_REFERENCE_LINKS.md`.

## Next actions
1. Owner reviews this reconciliation and the pack edits.
2. Owner/agent backs up both repos and verifies working tree (P0-01).
3. Establish baseline CI and the release-packaging check in `soravo_electron` (P0-02).
4. Prepare and review the rename checklist (P0-03).
5. Run a deep VM/toolchain/state audit and update `19_STATE_AUDIT_PROTOCOL.md` / `docs/engineering/STATE_AUDIT.md`.
6. Decide the CrispASR bundled layout and record ADR-0010 (P1-03).
7. Fix packaging and establish Windows/Linux CI baseline before commercial code.
8. Choose the backend placement and record ADR-0003 (P2-08); choose the binary host and finalise ADR-0005 (P8-00).
9. Create website shell and Supabase staging schema.
10. Configure Resend SMTP; test email delivery.
11. Implement account and device flows.
12. Implement entitlements, then Razorpay.
13. Build admin dashboard and release pipeline.
14. Prepare, then separately approve, the production cutover.

## Session handoff template
- Date/time and agent:
- Branch/commit:
- Working tree status:
- Task ID:
- Changed files:
- Commands/tests actually run:
- CI/CodeRabbit results:
- Decisions/ADRs:
- Blockers/owner action:
- Risks:
- Exact next task:
- Confirmed no secrets logged:
