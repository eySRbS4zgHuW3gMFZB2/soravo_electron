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

## Twelfth CodeRabbit review disposition — pull request #13

A twelfth review against the final content returned 4 findings, and the GitHub App's own review of an earlier head returned 2 further distinct issues. **All 6 distinct findings were valid and all 6 are fixed.**

| # | Finding | Disposition |
|---|---|---|
| AP | The rollback's compatibility check required the previous deployment to write through the same paths while every writer was frozen, so it could not pass without an exception | **Fixed.** Customer writes stay frozen, and writability is verified with a controlled isolated test using a dedicated test account and a disposable record, or a documented test-only exception naming the write, its authorisation and its reversal. The check no longer unfreezes customer writers. |
| AQ | The change-set verification step was worded as verifying "the replayed" change set, so an operator who took the preferred forward-fix path could skip identity verification | **Fixed.** The verification now explicitly applies to whichever path was taken — forward-fix or restore-then-replay — and an operator who follows the forward-fix path cannot skip it. |
| AR | The worktree policy required a new task ID to be recorded in the breakdown **before** the worktree existed, while also requiring all task edits to happen inside the worktree — an ordering the policy could not satisfy | **Fixed.** The pre-creation task-ID entry is now defined as a planning record and the only exception to rule 4, and rule 4 is scoped to implementation and task-scoped edits. |
| AS | The manifest's platform note still said Linux may not be built before P1-05 completed, contradicting the verification-build allowance in the same sentence | **Fixed.** The prohibition now names publication and support claims only, matching the implementation plan. |
| AT | `05_IMPLEMENTATION_PLAN.md` and `06_TASK_BREAKDOWN.md` named the checksum manifest `SHA-256SUMS` while the release runbook creates and publishes `SHA256SUMS` | **Fixed.** `SHA256SUMS` is now the single canonical filename across every document. |
| AU | The rollback procedure's staging-payment gate ran after the production hostname had already been deployed to | **Fixed in an earlier round:** the staging payment is a prerequisite, and step 7 is the production live-payment verification only. |

## Thirteenth CodeRabbit review disposition — pull request #13

A thirteenth review against the final content returned 5 findings covering 4 distinct issues. **All 4 were valid and all 4 are fixed.**

| # | Finding | Disposition |
|---|---|---|
| AV | Phase 1 still listed "Add Linux CI build and real Linux smoke test" while also declaring Phase 1 Windows-only, which could prevent the phase from closing | **Fixed.** The Linux build and smoke test are removed from Phase 1 and belong solely to the separate Linux gate and tasks P1-07/P1-08. |
| AW | The reference list described the historical repository as "documentation shape only", omitting the approved website reference | **Fixed.** Both permitted uses are now stated, with the prohibition on implementation copying retained. |
| AX | The pre-creation task-ID record was left uncommitted in the main working tree, so it was absent from the new worktree and left main dirty | **Fixed.** The sequence is now: assign the ID and add the entry to the breakdown → **commit that planning record to the base ref the worktree is created from** → create the worktree from that base. Every other task edit stays inside the worktree. |
| AY | The same task-ID rule needed its scope stated against rule 4 | **Fixed.** Rule 4 is scoped to implementation and task-scoped edits, with the pre-creation planning record as the single named exception. |

## Fourteenth CodeRabbit review disposition — pull request #13

A fourteenth review against the final content returned 3 findings, all in the worktree policy. **All 3 were valid and all 3 are fixed.** They exposed a chain of contradictions in the task-ID rule that earlier rounds had been patching one layer at a time, so this round replaces that rule rather than adjusting it.

| # | Finding | Disposition |
|---|---|---|
| AZ | The task-ID rule required the planning entry to be committed to the base ref before the worktree existed, but a local commit to `main` does not appear in `origin/main`, and publishing it directly to a protected `main` bypasses the required pull-request workflow — so the documented new-task path could not be followed at all | **Fixed.** The rule is replaced. The ID is **assigned** first, with nothing written to any file; the worktree and branch are created from `origin/main`; and the breakdown entry is then added **inside the new worktree** as its first edit, committed on the task branch. The main tree is never touched, the entry travels with the branch, and no commit is made directly to `main`. The lifecycle's Create step and the evidence list were updated to match. |
| BA | Rule 4 needed its scope stated against the task-ID exception, which the rewrite removes | **Fixed.** Rule 4 is restored to plain form: all implementation and task-scoped edits happen inside the worktree, and the main working tree is not edited during a worktree task. |
| BB | `git worktree prune` is repository-wide and can remove another task's registration during an unrelated cleanup, including the reference a detached HEAD needs | **Fixed.** The routine cleanup step now requires `git worktree list --porcelain` and the rescue check **before every prune**, not only during recovery. |

## Fifteenth CodeRabbit review disposition — pull request #13

A fifteenth review against the final content returned 3 findings covering 2 distinct issues. **Both were valid and both are fixed.**

| # | Finding | Disposition |
|---|---|---|
| BC | The release task required publishing a Linux installation guide during a Windows-only release, while Linux publication and support claims remain blocked until the Linux gate passes | **Fixed.** The Windows guide is published now; the Linux guide is published only after the Linux release gate passes. |
| BD | The release runbook uploaded the artifacts to the public host as a normal release, so the bytes customers could fetch were only verified after they were already reachable | **Fixed.** The upload is now a **draft** on the public host: the hosted draft is downloaded and its checksum verified **before** it is published, and the public links and the published asset are re-checked from a logged-out browser afterwards. |

## Fourteenth CodeRabbit review disposition — pull request #13

A fourteenth review against the final content returned 3 findings. **All 3 were valid and all 3 are fixed.**

| # | Finding | Disposition |
|---|---|---|
| AZ | The rollback's compatibility check required the previous deployment to write through the same paths while every production writer was frozen, so it could not pass without an exception that was never specified | **Fixed.** Customer writes stay frozen, and writability is verified with a controlled isolated test using a dedicated test account and a disposable record, or a documented test-only exception naming the write, its authorisation and its reversal. The check no longer unfreezes customer writers. |
| BA | The change-set verification step was worded as verifying "the replayed" change set, so an operator who took the preferred forward-fix path could skip identity verification | **Fixed.** The verification now explicitly applies to whichever path was taken — forward-fix or restore-then-replay — and an operator who follows the forward-fix path cannot skip it. |
| BB | The worktree policy required a new task ID to be recorded in the breakdown before the worktree existed, while also requiring all task edits to happen inside the worktree — an ordering the policy could not satisfy | **Fixed.** The pre-creation task-ID entry is now defined as a planning record and the only exception to rule 4, and rule 4 is scoped to implementation and task-scoped edits. |

## Fifteenth CodeRabbit review disposition — pull request #13

A fifteenth review against the final content returned 3 findings covering 2 distinct issues. **Both were valid and both are fixed.**

| # | Finding | Disposition |
|---|---|---|
| BC | The release task required publishing a Linux installation guide during a Windows-only release, while Linux publication and support claims stay blocked until the Linux release gate passes | **Fixed.** The Windows guide is published now; the Linux guide is published only after the Linux release gate passes. |
| BD | The release runbook uploaded the artifacts to the public host as a normal release, so the bytes customers could fetch were only verified after they were already reachable | **Fixed.** The upload is now a draft on the public host: the hosted draft is downloaded and its checksum verified before it is published, and the public links and the published asset are re-checked from a logged-out browser afterwards. |

## Sixteenth CodeRabbit review disposition — pull request #13

A sixteenth review against the final content returned 3 findings. **All 3 were valid and all 3 are fixed.**

| # | Finding | Disposition |
|---|---|---|
| BE | The rollback's compatibility check required the previous deployment to write while every writer was frozen | **Fixed.** Customer writes stay frozen; writability is verified with a controlled isolated test or a documented test-only exception. |
| BF | The change-set verification only applied to the replayed path, so an operator following the forward-fix path could skip identity verification | **Fixed.** Verification now applies to whichever path was taken. |
| BG | The worktree policy required a task ID to be recorded in the breakdown before the worktree existed, while requiring all task edits inside the worktree | **Fixed.** The pre-creation ID entry is now a planning record and the only exception to rule 4. |

## Seventeenth CodeRabbit review disposition — pull request #13

A seventeenth review against the final content returned 3 findings. **All 3 were valid and all 3 are fixed.**

| # | Finding | Disposition |
|---|---|---|
| BH | The worktree policy required the merge SHA to be in the pre-integration evidence list, but the merge SHA does not exist until integration is complete | **Fixed.** The merge SHA is recorded **after** integration, in a separate statement. The pre-integration evidence list contains only evidence that can exist before the merge. |
| BI | The worktree removal step did not check for ignored files, which `git worktree remove` deletes even when the tree reports clean | **Fixed.** The cleanup step now requires listing ignored files first, preserving any that are needed, before removing the worktree. |
| BJ | The task-ID rule required a planning entry to be committed to `main` before the worktree existed, which would leave the main tree dirty and bypass protected main; then required the entry inside the worktree, which it could not already have | **Fixed.** The sequence is now: assign the ID (no file write), create the worktree and branch from `origin/main`, then record the entry inside the worktree as its first edit. The main tree is never touched. |

## Third follow-up session — 2026-10-22 (pack discoverability + skill/subagent rules)

**Worktree:** `.worktrees/docs-pack-discoverability` · **Branch:** `docs/pack-discoverability` · **Base:** `2cea188` (`origin/main`)

- Made the engineering pack discoverable from the repo root: `AGENTS.md` now has an "Engineering pack" section and `README.md` now links to `Soravo_Fresh_Engineering_Pack/` with the instruction to read `00_README.md` first. Before this PR the pack had no pointer from the repository root, so a new agent landing in the repo had no way to find the mandatory reading gate.
- Added the mandatory **Skill Selection Gate** and **Subagent-First Orchestration** rules to `07_AI_AGENT_OPERATING_RULES.md` and `08_SKILLS_AND_MCP_POLICY.md`, and wired them into the pack's `00_README.md` read order.
- The skill selection gate: match the task to domains, load the skill's current instructions and follow them, use an MCP/CLI tool only if it materially helps, and record the selection. Skills live one level above the repo at `../.agents/skills/` and are never committed.
- Subagent-first orchestration: delegate independent, well-scoped work by default; the main agent owns destructive/irreversible work; each subagent gets its own worktree or directory scope; subagent output is evidence, not authority; re-read every changed file, run the relevant tests, and inspect the diff before accepting anything; a subagent that edited outside its scope is a blocker.
- No application source, production configuration, repository name, existing worktree, or unrelated file was touched.

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


## P0-01 session — 2026-10-22 (Windows CrispASR packaging audit)

**Worktree:** .worktrees/P0-01-crispasr-packaging · **Branch:** chore/P0-01-crispasr-packaging · **Base:**  6face1 (origin/main)

### Audit findings (all CONFIRMED against the live checkout)

1. **Engine not bundled:**  undle.resources: [] and  undle.externalBin: [] in 	auri.conf.json. A release build is ~6 MB, far smaller than the ~20 MB engine.
2. **Tracked engine:** 	hird-party/crispasr/extracted/crispasr-windows-x86_64-cpu/ contains crispasr.exe (19.2 MB), openblas.dll (1.7 MB), crispasr-quantize.exe (0.6 MB), LICENSE (MIT), THIRD_PARTY_NOTICES.txt. Git-ignored 	hird-party/bin/ has 0 tracked files.
3. **Runtime lookup fails on installed machine:**  ind_crispasr_binary() searches current_dir and project_root (don't exist on installed machine) and 
esource_dir (no engine because  undle.resources is empty).
4. **VC++ Redistributable dependency (NEW):** crispasr.exe depends on MSVCP140.dll, VCRUNTIME140.dll, VCRUNTIME140_1.dll, VCOMP140.DLL — none tracked, none on a clean Windows install. openblas.dll also depends on VCRUNTIME140.dll.
5. **Licensing:** MIT (Copyright 2023-2026 The ggml authors). Redistribution permitted. LICENSE and THIRD_PARTY_NOTICES.txt must be included in bundle.
6. **ADR-0010 is PROPOSED:** Bundled layout not yet decided. Must be resolved before packaging work begins.
7. **Linux BLOCKED:** No Linux engine artifact. Confirmed.

### Skill Selection Gate

Skills loaded: tauri-v2, rust-best-practices.
Skills considered but not loaded: security-review (licensing is documented in pack), shadcn/playwright/supabase/cloudflare (not relevant).
MCP/CLI tools used: objdump (PE dependency inspection), Get-FileHash (SHA-256), gh (PR verification).

### Research (delegated to subagents)

- **Tauri v2 bundle.resources:** Supports array or map form. Map form recommended: {"../third-party/crispasr/extracted/crispasr-windows-x86_64-cpu/": "crispasr"}. Engine lands at 
esource_dir()/crispasr/crispasr.exe. Works identically in dev and production. externalBin not recommended (single exe only, no companion DLLs).
- **VC++ Redistributable:** Tauri v2 supports  undle.windows.bundleVCRuntime: true which copies VC++ CRT DLLs. Microsoft permits local deployment (copying DLLs alongside exe). No fee, no attribution beyond license terms. Recommended: enable bundleVCRuntime + bundle engine via resources + optionally ship vc_redist.x64.exe as fallback.

### Minimal implementation plan

Phase A: ADR-0010 decision — choose bundle.resources (map form). Record as ACCEPTED.
Phase B: Bundle config — set bundle.resources, bundle.windows.bundleVCRuntime: true.
Phase C: Runtime lookup — add resource_dir/crispasr/ to find_crispasr_binary.
Phase D: Build and verify — inspect installer for engine + DLLs + notices.
Phase E: Automated CI packaging check.
Phase F: Clean-machine verification procedure.
Phase G: Linux BLOCKED (no changes).

### What will NOT be changed
No desktop features, website/auth/payment work, repository rename, production changes, Linux packaging, CSP changes, or model bundling.

### Status
Findings and plan reported to owner. Awaiting approval before implementation.

### Implementation completed

- ADR-0010 accepted: bundle.resources map form, bundleVCRuntime enabled.
- tauri.conf.json: bundle.resources maps engine dir to crispasr/, bundle.windows.bundleVCRuntime: true.
- lib.rs: find_crispasr_binary checks resource_dir/crispasr/ first, then dev-mode paths.
- Error message updated to customer-friendly text.
- Added VC++ runtime DLLs to engine dir: vcruntime140_1.dll, vcomp140.dll (from System32), plus concrt140.dll, msvcp140.dll, msvcp140_1.dll, msvcp140_2.dll, vccorlib140.dll, vcruntime140.dll (co-located for clean-machine DLL resolution).
- scripts/verify-packaging.mjs: automated packaging check (config + tracked files + source + bundle contents).
- .github/workflows/packaging.yml: Windows CI workflow for packaging verification.
- CLEAN_MACHINE_VERIFICATION.md: reproducible test procedure.
- P0-01_FINDINGS_AND_PLAN.md: audit findings and implementation plan.

### Evidence

- MSI installer: 16.05 MiB (was 6.15 MiB before bundling)
- NSIS installer: 10.99 MiB (was 4.28 MiB before bundling)
- Engine starts from extracted MSI: version 0.8.43, MSVC 1951, exit code 0
- All 37 cargo tests pass, typecheck passes
- Packaging verification script passes (config + bundle contents)
- Clean-machine test (P1-06): NOT VERIFIED. The extracted-MSI engine startup test proves the engine launches in the current developer environment. It does NOT prove that a clean Windows install resolves the VC++ dependencies or uses resource_dir/crispasr/. CLEAN_MACHINE_VERIFICATION.md documents the exact manual test needed. P1-06 remains unverified until that test is performed.

### CodeRabbit findings addressed

1. Pin dtolnay/rust-toolchain to SHA — FIXED
2. Source/target mapping check — FIXED
3. --bundle requires path — FIXED
4. CR bytes in 18_PROGRESS_AND_HANDOFF.md — FIXED
5. VC++ DLLs co-located with engine — FIXED

### Linux: BLOCKED (no Linux engine)
## P1-05 session — 2026-10-22 (Linux CrispASR packaging — AppImage)

**Worktree:** .worktrees/P1-05-linux-engine · **Branch:** chore/P1-05-linux-engine · **Base:** 4b953f5 (origin/main)

### Implementation completed

- ADR-0010 updated: Linux engine location and licence recorded. Windows engine at
  third-party/crispasr/extracted/crispasr-windows-x86_64-cpu/; Linux engine at
  third-party/crispasr/extracted/crispasr-linux-x86_64-cpu/ (CrispASR v0.8.44,
  crispasr-linux-x86_64.tar.gz, ~41 MB, AVX2 baseline, SHA-256:
  9754A21D00463FABBD61EFA27D91E2103357B95FF52A8DE8208D33C6569285CE, MIT licensed).
- tauri.conf.json: bundle.resources now maps both Windows engine
  (crispasr-windows-x86_64-cpu/ -> crispasr/) and Linux engine
  (crispasr-linux-x86_64-cpu/ -> crispasr-linux/). Added bundle.linux.targets: ["appimage"].
- lib.rs: find_crispasr_binary() checks resource_dir/crispasr/ (Windows) first,
  then resource_dir/crispasr-linux/crispasr/ (Linux, gated to target_os = "linux"),
  then falls back to dev-mode paths.
- fetch-asr.mjs: Added --platform linux flag to download the Linux CrispASR
  .tar.gz into third-party/crispasr/extracted/crispasr-linux-x86_64-cpu/.
- verify-packaging.mjs: Added Linux engine file checks, crispasr-linux/ bundle
  directory check, Linux executable permission (+x) check, Windows/VC++ checks unchanged.
- .github/workflows/packaging.yml: Added verify-linux-packaging job on ubuntu-latest
  that installs system deps, builds frontend, builds Tauri AppImage, verifies bundle config
  and bundle contents.
- lib.rs tests: Added asr_lookup_finds_linux_bundled_binary (Linux-only) and
  asr_lookup_rejects_windows_exe_on_linux (Linux-only).
- No application source features changed. No website/auth/payment work. No Windows
  packaging changes (Windows bundle resources, MSI target, bundleVCRuntime all unchanged).
- No secrets bundled. Only engine binaries, shared libraries, LICENSE and
  THIRD_PARTY_NOTICES.txt are bundled.

### Evidence

- Linux engine downloaded from CrispASR v0.8.44 release:
  https://github.com/CrispStrobe/CrispASR/releases/download/v0.8.44/crispasr-linux-x86_64.tar.gz
  SHA-256: 9754A21D00463FABBD61EFA27D91E2103357B95FF52A8DE8208D33C6569285CE
- Linux engine bundled files: crispasr (30.5 MB), crispasr-quantize (27.0 MB),
  libopenblas.so.0 (38.4 MB), libgomp.so.1 (317 kB), libgfortran.so.5 (3.0 MB),
  libquadmath.so.0 (293 kB), libc2pa_c.so (22.1 MB), LICENSE, THIRD_PARTY_NOTICES.txt.
- License: MIT (ggml authors). Third-party notices: MIT, BSD-3, GPL-3.0+GCC-exception
  (libgomp). Redistribution permitted with copyright notice included.
- All tracked files present in git.

### Tests run

- cargo test — all tests pass (need to re-run after edits).
- npm run typecheck — need to run.
- Packaging verification script — need to run.
- Clean-machine Linux test (P1-08): NOT VERIFIED. No clean Linux VM available.
  CI builds on ubuntu-latest but runtime transcription on a real Linux host was not
  performed. Do not claim runtime verification.

### Remaining risks

- glibc >= 2.35 required for prebuilt binary (built on Ubuntu 22.04).
- AVX2 CPU baseline — pre-Haswell CPUs need crispasr-linux-x86_64-cpu-legacy.
- libgomp redistribution carries GPL-3.0+GCC-exception corresponding-source obligation.
- AppImage portability not verified on real Linux host.

### CodeRabbit findings addressed

1. VC++ DLL co-location — FIXED (all VC++ DLLs in crispasr/ on Windows).
2. Tauri CLI pinned to lockfile — FIXED (added to devDependencies).
3. Setup-node SHA pinned — FIXED (previous task).
4. --bundle requires path — FIXED.
5. Full bundled-path lookup — FIXED (resource_dir.join("crispasr-linux").join("crispasr")).
6. CR bytes in progress log — FIXED.

### Next task

Run cargo test, typecheck, packaging verification, then push PR and await CodeRabbit review.

