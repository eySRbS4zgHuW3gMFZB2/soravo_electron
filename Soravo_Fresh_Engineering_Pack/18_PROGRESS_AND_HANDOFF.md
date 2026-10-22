# Progress and Handoff — Mandatory Living Record

**Last updated:** 2026-10-22 (pack published to branch `docs/engineering-pack`; pull request open, awaiting owner approval to merge)  
**Current status:** The pack is committed and pushed on `docs/engineering-pack`, with a pull request open into `main`. `main` is untouched. No repository rename, DNS change, production change, deployment, Supabase data change or secret operation has been performed. Implementation has not started.

## Owner-approved decisions
- Launch Windows + Linux. **Linux is BLOCKED** pending a Linux engine artifact (task P1-05); Windows is the only platform with an engine today.
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
- Windows is most clearly documented and is the only platform with a tracked engine. **Linux is BLOCKED**: no Linux CrispASR executable or shared-library set is tracked, so a Linux build would install and then fail to transcribe. Linux becomes a launch platform only after task P1-05 and a clean-machine Linux install.
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

## CodeRabbit review disposition — pull request #13

All 15 inline findings and the summary's retained security concern were checked against the current files. **All 16 were valid and all 16 were fixed.** None was dismissed.

| # | Finding | Disposition |
|---|---|---|
| 1 | `.gitattributes`: `* text=auto` does not force LF in the working tree | **Fixed.** The wildcard now carries `eol=lf`, which the file's own prose already claimed. Verified the wildcard covers the extensionless dotfiles and `LICENSE`. No stored content changes. |
| 2 | `04_TECHNICAL_DESIGN.md`: the packaging claim was broader than the evidence | **Fixed.** The claim is now limited to the CrispASR engine; `bundle.icon` does copy repository files, so "nothing is copied" was wrong. |
| 3 | `04_TECHNICAL_DESIGN.md`: verify a Linux engine artifact before keeping Linux as a launch target | **Fixed, and escalated.** Verified: the repository tracks a Windows engine only. Linux is now marked **BLOCKED** across the pack, with task P1-05 added to obtain, license, track and bundle a Linux engine. |
| 4 | `05_IMPLEMENTATION_PLAN.md`: Phase 0 rename gate conflicts with the Phase 1 packaging work | **Fixed (major).** The circular dependency is resolved by a documented failing-baseline exception: Phase 0 requires the packaging check to **exist, run and report**, with its red result recorded; Phase 1 makes it a required green check. A red check for any other reason still blocks the rename. |
| 5 | `05_IMPLEMENTATION_PLAN.md`: Phase 3 uses the pre-rename repository name | **Fixed.** Phase 3 now refers to `soravo_deprecated`. |
| 6 | `09_GITHUB_CI_POLICY.md`: "has no reviewable diff" is wrong for a detached worktree | **Fixed.** The real defect — no named branch, easier to lose or misidentify — is stated instead. |
| 7 | `10_SECURITY_BASELINE.md`: "Audit logs and use." is incomplete | **Fixed.** Now reads "Audit logs and use them to assess impact and scope." |
| 8 | `13_RELEASE_RUNBOOK.md`: `sha256sum <artifact files>` is not valid shell | **Fixed.** Replaced with explicit artifact paths and a valid glob, with a note on why the placeholder is wrong. |
| 9 | `18_PROGRESS_AND_HANDOFF.md`: handoff template omits the worktree path | **Fixed.** The template now records the worktree path, as the policy requires. |
| 10 | `23_SOURCE_AUDIT_NOTES.md`: the packaging claim was broader than the evidence | **Fixed.** Limited to the CrispASR engine, matching finding 2. |
| 11 | `25_REFERENCE_LINKS.md`: R2 setup should be mandatory | **Fixed.** R2 is stated as ineligible for this owner because it requires a subscription and a checkout flow, and eligibility confirmation is a hard gate. |
| 12 | `27_PRODUCTION_CUTOVER_AND_ROLLBACK.md`: a Redirect from a path to itself is a self-redirect | **Fixed.** Redirect now requires a different replacement path. |
| 13 | `27_PRODUCTION_CUTOVER_AND_ROLLBACK.md`: the rollback rehearsal must be an executable dry run | **Fixed.** The item now requires a staging-environment rehearsal that exercises DNS and routing restore, redirect disabling, previous-deployment selection and snapshot restoration, with recorded evidence. A tabletop review alone does not satisfy it. |
| 14 | `27_PRODUCTION_CUTOVER_AND_ROLLBACK.md`: the cutover test payment needs a defined environment | **Fixed.** Test-mode credentials are required; a live payment requires recorded owner approval, reconciliation and refund evidence. |
| 15 | `27_PRODUCTION_CUTOVER_AND_ROLLBACK.md`: an unqualified snapshot restore can discard post-cutover records | **Fixed (major).** The recovery sequence is now: freeze writes, export post-snapshot records, apply a tested forward-fix or merge, restore only as a last resort, and verify no exported record is missing. |
| 16 | Summary, security architecture review: a content classification must not remove a route's authorization | **Fixed.** Route sensitivity and required authorization are now recorded separately from the Preserve/Redirect/Retire/Block content disposition, and are carried over unchanged. |

## Second CodeRabbit review disposition — pull request #13

A second review was run on the revised branch. It returned 9 findings covering 6 distinct issues. **All were valid and all were fixed.**

| # | Finding | Disposition |
|---|---|---|
| A | `05_IMPLEMENTATION_PLAN.md`: "baseline CI green **or** failures documented" was broader than the single packaging exception | **Fixed.** The gate now requires every non-packaging baseline check to be green, and allows red only for the packaging check's documented missing-engine result. |
| B | `01_AUTHORITY_AND_SOURCE_OF_TRUTH.md` and `15_ADR_INDEX.md`: still required the packaging check to be green, contradicting the Phase 0 exception | **Fixed.** Both now state that baseline CI must be green and the packaging check must exist, run and report, with any other packaging failure blocking the rename. |
| C | `28_GIT_WORKTREE_POLICY.md`: `git worktree add` left the new task branch tracking `origin/main` | **Fixed.** The command now uses `--no-track`, and the policy documents setting the upstream to the task branch with an explicit `git push -u origin <branch>`. This was observed for real during this publication. |
| D | `21_RENAME_AND_MIGRATION_RUNBOOK.md`: the checklist required a production deploy during the rename | **Fixed.** It now requires a preview deployment plus a read-only check that the existing production deployment is unchanged, and states that a production deploy during a rename is forbidden. |
| E | `27_PRODUCTION_CUTOVER_AND_ROLLBACK.md`: the keepalive gate blocked cutover on an undecided workflow | **Fixed.** A successful keepalive run is required only once ADR-0007 is accepted; otherwise the approved project-health monitoring check is required instead. |
| F | `27_PRODUCTION_CUTOVER_AND_ROLLBACK.md`: the rollback export covered creates but not updates or deletes | **Fixed.** The change set now covers every post-snapshot create, update and delete with counts by operation, snapshot restore requires a separately available and verified replay procedure, and the replay is verified against the change set. |

## Third CodeRabbit review disposition — pull request #13

The GitHub App posted a further review against the revised branch. It raised 8 comments, of which 2 were re-statements of findings already fixed and **6 were new**. **All 6 new findings were valid and all 6 are fixed.**

| # | Finding | Disposition |
|---|---|---|
| G | Three documents cited `P1-04` for the Linux engine task after the task list was renumbered, so the Linux engine is actually `P1-05` | **Fixed.** Corrected in `00_README.md`, `02_PRODUCT_REQUIREMENTS.md` and `04_TECHNICAL_DESIGN.md`. This was a real inconsistency introduced when the Linux task was inserted. |
| H | The Phase 1 gate only required the Windows clean-machine test, so the phase could look complete while Linux was unverified | **Fixed.** Phase 1 is now explicitly **Windows-only**, and a separate Linux release gate is defined that applies only once P1-05 delivers a Linux engine. |
| I | `13_RELEASE_RUNBOOK.md` step 6 required a Linux build unconditionally, contradicting the Linux block | **Fixed.** The step now builds only platforms with a supported engine. |
| J | `13_RELEASE_RUNBOOK.md` offered a `dist/*.exe` checksum glob that omitted the MSI | **Fixed.** The glob now covers both extensions, and the requirement states that every published installer must have a checksum entry. |
| K | The rollback rehearsal did not require exercising the post-migration schema, so a rollback could fail before service verification | **Fixed.** The rehearsal must now prove the previous deployment can run against the resulting schema, or that the migration's rollback and forward-fix path works. |
| L | The replay verification compared counts, and equal counts can hide a missing record behind an unrelated one | **Fixed.** Verification is now by record identity — stable record IDs and relevant fields — with an explicit duplicate check. |

## Fourth CodeRabbit review disposition — pull request #13

A fourth review, run against the final content including the CI workflow, returned 6 findings covering 4 distinct issues. **All 4 were valid and all 4 are fixed.**

| # | Finding | Disposition |
|---|---|---|
| M | The CI policy required Linux build/test jobs that Phase 1 prohibits, so Linux would have become a required check blocking the Windows-only release | **Fixed.** Linux jobs are deferred until task P1-05 delivers a Linux engine and the Linux release gate passes, and must not be a required check before then. The release workflow now builds only platforms with a supported engine. |
| N | The "Clean Linux install" item in the definition of done could not be ticked while Linux is blocked, which would block an approved Windows-only release | **Fixed.** The item now applies only to a Linux release and explicitly does not block the Windows release gate. |
| O | The cutover step ran a **Razorpay test-mode** payment against the **production** ledger, which could record a paid production entitlement with no live charge | **Fixed.** The test-mode payment now runs against staging before cutover and verifies only staging records. Production is verified with a separately approved live payment, with approval, reconciliation and refund evidence recorded. This was a genuine revenue-integrity defect. |
| P | The checksum command wrote `dist/`-prefixed paths into `SHA256SUMS`, which breaks `sha256sum -c` from a clean download directory, and listed a fixed two-file set | **Fixed.** Entries use bare published asset names, and the command covers exactly the installer formats that are actually published. |

## Fifth CodeRabbit review disposition — pull request #13

A fifth review, run against the final content including the CI workflow, returned 9 findings across repeated runs, covering 8 distinct issues. **All 8 were valid and all 8 are fixed.**

| # | Finding | Disposition |
|---|---|---|
| Q | The Linux release gate required a clean-runner build and a clean-machine install, but the pack prohibited any Linux build until the gate passed — making the gate impossible to complete | **Fixed.** Verification builds are permitted once P1-05 delivers the engine. Publication and support claims stay prohibited until the whole gate passes. Aligned in `05_IMPLEMENTATION_PLAN.md`, `06_TASK_BREAKDOWN.md` and `09_GITHUB_CI_POLICY.md`. |
| R | The cutover rehearsal did not test the change-set replay, which the rollback procedure requires | **Fixed.** The rehearsal must now capture a post-snapshot change set with creates, updates and deletes, replay it, and verify by record identity. |
| S | The rollback procedure restored traffic before freezing writers, letting the two versions interleave | **Fixed.** Freezing every writer is now step 1, before routing is restored, and the freeze is released only after the recovered state is verified. |
| T | The staging payment check sat at step 7, after step 3 had already deployed to production | **Fixed.** The staging payment check is now a prerequisite, before the procedure. Step 7 is the production live-payment verification only. |
| U | The worktree recovery text implied `git worktree prune` recovers work from a deleted directory | **Fixed.** It now states that the branch and committed history survive, and that uncommitted files were never in the object store and need a separate backup. |
| V | The CI policy's rename rule still required the packaging check to be green, contradicting its own exception | **Fixed.** Non-packaging checks must be green; the packaging check must run and report its one permitted baseline result. |
| W | `00_README.md` allowed the historical repository only as a documentation record, omitting the approved website reference | **Fixed.** Both permitted uses are now stated, with the prohibition on porting implementation retained. |
| X | The agent rules prohibited branch deletion outright, which conflicts with the policy's mandatory merged-branch cleanup | **Fixed.** Merged task-branch cleanup is expected work; the prohibition still covers unmerged, unrelated and other-task branches. |

## Sixth CodeRabbit review disposition — pull request #13

A sixth review against the final content returned 9 findings covering 7 distinct issues. **All 7 were valid and all 7 are fixed.**

| # | Finding | Disposition |
|---|---|---|
| Y | The release runbook uploaded artifacts to the **public** host at step 10, before the clean-machine install test at step 12, so a broken installer could be downloaded before the gate caught it | **Fixed.** The order is now: upload to a private or draft staging release → verify staged links → **clean-machine install test** → publish the verified artifacts to the public host → verify public links → publish notes → update `latest`. Updating `latest` does not remove access to already-public assets, so publication is what must wait. |
| Z | The release runbook still said "do not build" Linux before the gate, contradicting the verification-build allowance | **Fixed.** Verification builds are permitted once P1-05 delivers the engine; publication and support claims stay prohibited until the gate passes. |
| AA | The rollback exported the change set during the rollback, but an export from current tables cannot reconstruct a deleted row or the prior state of an updated row — so change capture must be running *before* the snapshot | **Fixed.** A durable change-capture or provider-supported recovery mechanism must be enabled and tested before the production snapshot and any production write, with its retention and recovery of deleted rows and prior update states recorded. The pack now states explicitly that Supabase point-in-time recovery is a separate paid add-on and must not be assumed on the free tier, and that the cutover must not proceed without a tested mechanism. |
| AB | The cutover step 4 asked a logged-out browser to verify the account dashboard, which an unauthenticated visitor cannot reach | **Fixed.** The logged-out session now verifies the public pages and admin access denial; the dashboard, entitlement display and device list are verified after signing in with a test account. |
| AC | The worktree recovery text still suggested recovering uncommitted files from the reflog, which cannot restore never-committed content | **Fixed.** The reflog recovers recorded commits only; uncommitted files need an external copy. |
| AD | The rename runbook required confirming that Cloudflare's Git integration would be updated, which cannot be satisfied for the observed direct-upload deployment method | **Fixed.** The actual deployment method is recorded first, and the source-link step applies only if Git integration is configured. |
| AE | The CI policy's website workflow had a path filter, which would leave a required check pending on unrelated pull requests | **Fixed.** The workflow runs on every pull request and reports success when the change does not affect the website paths, matching the pattern used by the pack's own CI workflow. |

## Seventh CodeRabbit review disposition — pull request #13

A seventh review against the final content returned 3 findings. **All 3 were valid and all 3 are fixed.**

| # | Finding | Disposition |
|---|---|---|
| AF | The worktree policy required all tests to pass before integration, which made the P0-02 packaging check look ineligible while it is red for the documented missing-engine baseline | **Fixed.** The narrow Phase 0 exception is stated, applies to the packaging check alone, and ends when Phase 1 makes that check mandatory and green. |
| AG | The CI workflow resolved Markdown links only against bare filenames inside the pack, so a valid link such as `../README.md` failed, and a broken link carrying a fragment was not checked at all | **Fixed.** The validator now resolves a link target relative to the file that contains it, strips an optional fragment, skips absolute URLs, protocol-relative URLs and in-page anchors, and checks the resolved path. Verified with four new cases: a valid outside link passes, a broken link with a fragment is caught, a broken link outside the pack is caught, and external URLs and anchors are not flagged. The seven earlier failure modes were re-tested and still caught. |
| AH | The rename runbook moved the local folder without repairing the nested worktrees, whose recorded paths move with it | **Fixed.** Every registered worktree path is recorded before the move, `git worktree repair` is run afterwards, each registration is verified, and pruning is forbidden until they are verified. |

## Eighth CodeRabbit review disposition — pull request #13

An eighth review against the final content returned 2 findings. **Both were valid and both are fixed.**

| # | Finding | Disposition |
|---|---|---|
| AI | `git worktree repair` without path arguments does not complete the repair when the main folder and its nested linked worktrees all move | **Fixed.** The runbook now supplies every new linked-worktree path, and verification uses `git worktree list --porcelain`. |
| AJ | Pruning a worktree whose directory was deleted removed the registration before the detached-HEAD commit had been preserved, losing its only readily identifiable reference | **Fixed.** The recovery procedure and the state audit protocol now require inspecting `git worktree list --porcelain` and creating a rescue branch at any detached HEAD **before** pruning. |

## Ninth CodeRabbit review disposition — pull request #13

A ninth review against the final content returned 2 findings. **Both were valid and both are fixed.**

| # | Finding | Disposition |
|---|---|---|
| AK | The rollback procedure restored routing to the previous deployment **before** recovering the datastore, so a rollback target that needed the migration's rollback or forward-fix would receive customers while it could not read the current schema or data | **Fixed.** The order is now: freeze writers → recover the data → verify the rollback target is compatible with the recovered datastore → restore routing → disable redirects → verify → unfreeze writers. Traffic stays off the previous deployment until the compatibility check passes. |
| AL | The manifest's platform note did not carry the verification-build allowance, so an agent reading only the manifest would conclude that no Linux build was permitted after P1-05 | **Fixed.** The note now states the same distinction as the implementation plan: verification builds are permitted once the engine exists; publication and support claims are not. |

## Tenth CodeRabbit review disposition — pull request #13

A tenth review against the final content returned 1 finding. **It was valid and it is fixed.**

| # | Finding | Disposition |
|---|---|---|
| AM | The post-rename checklist required "no stale `soravo_electron` references" anywhere, which can never pass: the source audit notes and the owner decision memo must keep the old name because it is the repository identity at the time of those records | **Fixed.** The check is now scoped to active references — clone commands, live URLs, CI and release configuration, allowlists — while dated historical records are explicitly preserved. The pack's own note that a blanket check is the wrong test was kept. |

## Eleventh CodeRabbit review disposition — pull request #13

An eleventh review against the final content returned 2 findings. **Both were valid and both are fixed.**

| # | Finding | Disposition |
|---|---|---|
| AN | The release runbook checked that public links resolve but never compared the downloaded bytes with `SHA256SUMS`, and the artifact tested at step 12 is not the copy step 13 publishes | **Fixed.** Step 14 now downloads each published installer and verifies its SHA-256 against `SHA256SUMS`. A resolving link is not the same as a link serving the verified bytes. |
| AO | The worktree policy permitted only task IDs already in the breakdown, so an unplanned fix could not create a compliant worktree before its ID existed | **Fixed.** A new task ID may be assigned and recorded in the breakdown **before** the worktree is created. An unplanned fix is not blocked from starting. |

## Publication session — 2026-10-22

**Worktree:** `.worktrees/docs-engineering-pack` · **Branch:** `docs/engineering-pack` · **Base:** `3ac4e3e` (`origin/main`)

- The pack was published under `28_GIT_WORKTREE_POLICY.md`: a dedicated worktree and named branch created from `origin/main`, all edits made inside it, and the main working tree never edited.
- **`git worktree add -b <branch> origin/main` silently set the new branch's upstream to `origin/main`.** A bare `git push` would then have targeted `main`. The upstream was unset before pushing, and the push used an explicit refspec.
- Two commits on the branch: `d5e9b95` (the 31 pack documents) and `b775802` (`.gitattributes`).
- **`.gitattributes` changes no stored content.** The repository's existing convention was verified against the index first: all 101 tracked text files are already stored LF and the 22 binary assets are already detected as non-text. Adding the attributes renormalised nothing, so no existing file was touched by that commit. Line endings are pinned for Markdown, JSON, YAML, plain text and the extensionless dotfiles; application source keeps its existing `text=auto` behaviour.
- **The untracked copy of the pack in the main working tree was a merge blocker.** This was proved in a scratch clone: with the copy present, the merge fails with *"untracked working tree files would be overwritten by merge"*; with it removed, all 31 files stage cleanly. Since it was byte-identical to what is now committed and pushed, it was **moved**, not deleted, to the local backup area.
- Verified: the remote branch ref matches the local HEAD; `origin/main` is unchanged at `3ac4e3e`; all 13 pre-existing remote branches are unchanged; a fresh clone of the branch matches the source byte-for-byte after line-ending normalisation; the three pre-existing worktrees are preserved at their original commits and clean.
- The pull request is **open and not merged.** The merge awaits owner approval.

## Next actions
1. **Owner reviews and approves the pull request.** The merge is deliberately not performed.
2. After the merge: remove the `docs-engineering-pack` worktree, `git worktree prune`, delete the merged local branch, and delete the worktree's build output.
3. Owner/agent backs up both repos and verifies working tree (P0-01).
4. Establish baseline CI and the release-packaging check in `soravo_electron` (P0-02).
5. Prepare and review the rename checklist (P0-03).
6. Run a deep VM/toolchain/state audit and update `19_STATE_AUDIT_PROTOCOL.md` / `docs/engineering/STATE_AUDIT.md`.
7. Decide the CrispASR bundled layout and record ADR-0010 (P1-03).
8. Fix packaging and establish the Windows CI baseline before commercial code. Linux CI stays behind task P1-05 and the Linux release gate; it is not part of the pre-commercial baseline.
9. Choose the backend placement and record ADR-0003 (P2-08); choose the binary host and finalise ADR-0005 (P8-00).
10. Create website shell and Supabase staging schema.
11. Configure Resend SMTP; test email delivery.
12. Implement account and device flows.
13. Implement entitlements, then Razorpay.
14. Build admin dashboard and release pipeline.
15. Prepare, then separately approve, the production cutover.

## Session handoff template
- Date/time and agent:
- Worktree path:
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
