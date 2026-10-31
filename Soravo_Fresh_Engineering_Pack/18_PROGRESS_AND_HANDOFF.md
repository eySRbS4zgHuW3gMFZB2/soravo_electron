# Progress and Handoff — Mandatory Living Record

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:1e86d09e96ab0d3243cf421dd82cc502ea8b444b695e4842c5c3a69b217e3b8b -->

**Last updated:** 2026-10-31 (backend admin deployment recorded on 2026-10-30)

**Current status:** On 2026-10-30, migrations 006–008 and the admin-dashboard Edge Function were deployed to Soravo_fresh; preview smoke checks are recorded below. Production site cutover and admin bootstrap have not occurred; no admin user was created or granted an admin role. The production site, DNS, and email configuration remain untouched until separately approved cutover after the launch checklist and rollback rehearsal; bootstrap remains pending owner approval of the account.

<!-- /coderabbit-ai-generated:v1 -->

## Owner-approved decisions

- Launch Windows + Linux. Windows and Linux CrispASR engines are now tracked and bundled; Linux publication and supported-platform claims remain **BLOCKED** pending clean-machine runtime and dictation verification.
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
- Binary distribution host accepted in ADR-0005: separate public `soravo-releases` artifacts-only repository. Publication still requires clean-machine verification, the Linux release gate when publishing Linux artifacts, and owner approval of each release.
- Rename old repo `soravo` to `soravo_deprecated`; active repo `soravo_electron` to `soravo`; local folder to `soravo`.
- Do not copy code/schema/spec implementation from old repo.

## Decisions approved in the 2026-10-22 memo (highest authority in this pack)

- **Website: rebuild fresh; preserve the current site until cutover.** The historical repository is a behavioral/content reference only for approved website content and behavior; its implementation, schema, migrations, Edge Functions and Handy-derived desktop code are not ported. `soravo.xyz` and its DNS/email configuration stay untouched until the replacement passes its launch checklist. Recorded as ADR-0008 and `27_PRODUCTION_CUTOVER_AND_ROLLBACK.md`.
- **Repository rename: CI first.** Order is backup/audit → baseline CI and release-packaging checks → rename checklist → rename → post-rename verification. Recorded as ADR-0009, and in `05_IMPLEMENTATION_PLAN.md` Phase 0, `06_TASK_BREAKDOWN.md` P0 and `21_RENAME_AND_MIGRATION_RUNBOOK.md`.
- **Production domain: preserved through the migration.** Cutover is a separate, explicitly approved, reversible step with a URL inventory, tested redirects and a rehearsed rollback. Recorded in `27_PRODUCTION_CUTOVER_AND_ROLLBACK.md`, Phase 8 and tasks P3-09/P8-09/P8-10.
- **CrispASR packaging finding corrected** in `23_SOURCE_AUDIT_NOTES.md`; the bundled layout is ACCEPTED in ADR-0010 (2026-10-22, task P0-01) and a clean-machine install proving engine launch is an explicit release blocker.
- **ADR/TDD consistency:** ADR-0003 is ACCEPTED for Supabase Edge Functions (2026-10-23). ADR-0010 is ACCEPTED for Tauri `bundle.resources` map form with bundled VC++ runtime; its recorded rationale, redistribution checks and clean-machine release gates remain binding; ADR-0005 is accepted for the public `soravo-releases` artifacts-only host.
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
- Windows packaging is implemented, while clean-machine launch and dictation remain unverified. **Linux is BLOCKED for publication**: Linux CrispASR artifacts are tracked and bundled, but no clean-machine Linux install, launch or dictation verification has yet been completed. Linux becomes a release platform only after that gate passes.
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
7. Follow the accepted ADR-0010 bundled layout for P1-03; the decision prerequisite is satisfied.
8. Fix packaging and establish the Windows CI baseline before commercial code. Linux CI stays behind task P1-05 and the Linux release gate; it is not part of the pre-commercial baseline.
9. Apply ADR-0005's remaining publication gates: clean-machine verification, the Linux release gate when publishing Linux artifacts, and owner approval. The binary host is accepted as public `soravo-releases`; backend placement is Supabase Edge Functions (ADR-0003, accepted 2026-10-23).
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
6. **Historical ADR-0010 finding (superseded):** the initial audit found the layout PROPOSED; ADR-0010 was subsequently ACCEPTED (2026-10-22, task P0-01), as recorded in the implementation outcome below.
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

Phase A: ADR-0010 decision — completed as ACCEPTED (2026-10-22, task P0-01): bundle.resources (map form).
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


## ADR-0003 Backend Placement (2026-10-23)

### What was decided

- Supabase Edge Functions chosen as the privileged API backend
- Cloudflare Pages hosts the static website only
- ADR-0003 updated from 'ACCEPTED in part; PROPOSED' to 'ACCEPTED'
- 04_TECHNICAL_DESIGN.md updated to reflect the decision

### Rationale

1. Data proximity - Edge Functions run in the same Supabase project as Auth and Postgres
2. Auth integration - native access to Supabase Auth context for JWT verification
3. Secret management - service-role keys stay within Supabase trust boundary
4. RLS enforcement - clean separation between client (RLS) and server (service-role) access
5. Single provider for privileged logic - no duplication across providers

### Trade-offs accepted

- Deno runtime (not Node.js) - some npm packages may not be compatible
- Supabase free tier invocation limits - monitor and upgrade if needed
- Cloudflare Pages still hosts static website; Edge Functions invoked via Supabase URL

### What this unblocks

- Razorpay webhook endpoint implementation
- Entitlement provisioning
- Device registration/limit checking
- Admin operations
- All server-side business logic

### Implemented since this decision

### Still not done

- Device registration Edge Function implemented (register-device)
- Payment and entitlement Edge Functions implemented as code: create-order, razorpay-webhook, finalize_webhook_payment_atomic
- Live Razorpay provider setup and Deno deployment remain unverified
- Design documents exist alongside implementation

## New Project Isolation (2026-10-23)

### What was documented

- Updated ADR-0003 with new Supabase project isolation requirements
- Updated 04_TECHNICAL_DESIGN.md with new project isolation section
- Created 31_NEW_PROJECT_ISOLATION_AND_SETUP.md with safe setup steps
- Updated manifest (version 1.4.0)

### Key decisions

- Existing Supabase project 'soravo' and live site soravo.xyz belong to the past project
- New Supabase project required (separate credentials, schema, data)
- New Cloudflare Pages project required (separate from soravo.xyz)
- No infrastructure created, no production settings changed
- No data migration or credential reuse from old project

### What is NOT done

- No Supabase project created (requires owner approval)
- No Cloudflare Pages project created (requires owner approval)
- No DNS changes
- No environment variables configured in production

## Website Foundation (2026-10-23)

### What was implemented

- website/ directory with Vite + React 18 + TypeScript + Tailwind v4
- shadcn/ui-compatible component structure (radix-nova style)
- Pages: LandingPage, PricingPage, LoginPage, SignupPage, AccountPage
- Supabase client integration with auth context
- Database schema migration (profiles, devices, entitlements, payments, webhook_events, admin_audit_events)
- RLS policies for all tables
- Web-desktop auth contract document (29_WEB_DESKTOP_AUTH_CONTRACT.md)
- Razorpay integration design document (30_RAZORPAY_INTEGRATION_DESIGN.md)
- .env.example with placeholders
- Basic test for Supabase client

### What genuinely works

- Website dev server starts and renders all pages
- Supabase auth client is configured (requires env vars)
- Database schema is defined with RLS policies
- Pricing page shows the approved prices: USD 12/month (recurring, max 3 devices, 14-day offline grace) and USD 50 lifetime (unlimited devices, indefinite offline)
- Device registration Edge Function implemented (register-device) with atomic limit enforcement and JWT validation

### Remaining blockers

- Supabase project not yet created/configured (requires owner approval)
- Razorpay payment code is implemented (create-order, razorpay-webhook, finalize_webhook_payment_atomic); live provider setup and deployment remain pending
- Web-desktop auth flow not implemented (contract only)
- Payment verification is webhook-driven; no browser-only provisioning
- Clean-machine Linux test still outstanding (P1-08)
- PR #17 and PR #18 not yet merged

## Auth and device review fixes — 2026-10-24 (P2-06 / P3-04 / P4-04)

- Task checkout/worktree: `repos/github.com/eysrbs4zghuw3gmfzb2/soravo_electron`; assigned branch `coderabbit/harden-auth-and-device-registration/c8575ad5`; base `1ae7c4c402d11ee2f9f41dea9c2c5c88299a3aa3`. The cloud runtime supplies this isolated task checkout; retained for review, with no integration performed.
- Verified all four supplied findings: preserve current session and clear loading on returned/rejected restoration errors; catch sign-out failures with a retry message; describe confirmation as account creation; log entitlement/RPC/unexpected registration errors while retaining existing 500 responses.
- Skills: loaded `code-review`; Supabase, React and security skills considered but unavailable in the declared local skill directory/session catalog. Used existing contracts and standard error handling. A read-only subagent independently verified the device logging finding; all edits and executable validation performed by the primary agent.
- Temporary behavioral harness: 11 checks passed, covering real components and handler with synthetic fixtures; no production services or credentials used. Website typecheck, production build, and all 19 existing tests also passed. Validation evidence is kept outside the repository in `workspace-context/validation-record.md`.
- No architecture/entitlement contract changes. Rollback: revert this patch. Work remains uncommitted for the user's review.

## P2-11 review fixes — 2026-10-24

- Task checkout: `repos/github.com/eysrbs4zghuw3gmfzb2/soravo_electron`; assigned branch `coderabbit/clarify-task-scopes-webhook-claims/e23753fb`; base `66ac18f2f0275109960f7fd192a43be0214571dc`. The cloud runtime supplies this isolated task checkout; retained for review with no integration performed.
- All three supplied findings were confirmed. Restored P2-10 ownership of device, entitlement and webhook DB tests (per `df9d608`); P2-11 owns reconciliation. Corrected the Edge Function serve command to run from `website/` using `supabase/.env.local`.
- Webhook acquisition/reclaim replaces the claim token; all terminal ledger writes require that token and `processing` state. Success paths require one returned row, so stale finalization yields a retryable failure. SQL asserts token replacement and zero/one rows for prior/reclaimed tokens; actual-handler tests cover acquisition, reclaim, duplicate/active leases and all five stale terminal paths.
- Skills: loaded `code-review`. Supabase/Postgres and security skills considered but unavailable in the local/session catalog; applied the existing design/ADR contract and standard conditional-update checks. A read-only subagent independently verified task history and claim requirements; the primary agent performed all edits and executable checks.
- Validation: `npm run typecheck`, `npm run build`, `npm test` passed (29 tests); final targeted handler rerun passed (10 tests). Applied the unchanged migration to disposable PostgreSQL 17.11 with synthetic Auth fixtures and pgTAP; webhook 9/9 and device 8/8 assertions passed. Exact commands/input identities are in `workspace-context/validation-record.md` outside the repository.
- Security/limits: repairs ledger claim fencing only. Payment/entitlement writes remain separate transactions without the broader side-effect fencing required by ADR-0003; this pre-existing gap remains open. No provider credentials, configuration, data or production state changed. Deno deployment compatibility was not exercised. Rollback: revert this patch. Changes remain uncommitted.


## Release gates and routing review fixes — 2026-10-27

- Task checkout/worktree: `repos/github.com/eysrbs4zghuw3gmfzb2/soravo_electron`; branch `coderabbit/release-gates-and-routing/d7d742a1`; base/current HEAD `7202d2b802da2ae0751dbd28b2096f2782b6a17d`. The cloud runtime supplies this isolated task checkout; the documentation subagent edits only this pack, excluding `19_STATE_AUDIT_PROTOCOL.md`. Checkout retained for review; no integration performed.
- Verified ADR-0003 and ADR-0005 are ACCEPTED. Moved backend placement and binary hosting out of open decisions; aligned the operating rule, runbook, task breakdown, manifest and matching handoff entries. Host publication still requires clean-machine verification and owner approval, with the Linux release gate required when publishing Linux artifacts.
- Historical review outcome (superseded by the ADR-0010 status alignment below): preserved the then-requested ADR-0010 PROPOSED implementation restriction. Existing conflict: `15_ADR_INDEX.md` records ADR-0010 as ACCEPTED, while the operating rule and planning records mark it PROPOSED. This review does not change that ADR or resolve the conflict.
- Skills: `code-review` loaded by the primary agent and documentation subagent; integrated review belongs to the primary agent. Cloudflare, Wrangler and Playwright skills are unavailable in this session; documentation edits follow the existing accepted ADRs. No additional domain skill is needed for the status corrections.
- Release workflow: added a required content gate for every NSIS installer, independently of MSI output; exact configured app version and filename-segment matching; source tag verification against the built SHA before draft creation, with an explicit release target SHA. Existing MSI, configuration, size and checksum checks remain.
- Website: retained Vite tests and added production-build navigation coverage through pinned Wrangler Pages in local tests and website CI. Actual Wrangler execution exposed an ignored catch-all `/index.html` rewrite; targeting `/` fixes the loop warning while preserving SPA navigation. Added local output ignores. Existing locked dependency versions are preserved.
- Validation: website typecheck/build and 42 unit tests passed; final Playwright run passed 29 tests (21 Vite, 8 Pages) with no redirect warnings. Release harness passed 63 subprocess assertions using actual synthetic NSIS archives and 7-Zip extraction, PowerShell version/staging checks, real local Git tags and an explicit synthetic gh stub. Configuration/tracked-engine verification, manifest assertions, pack CI validator (35 documents) and whitespace checks passed. Exact commands and input identities are recorded in `workspace-context/validation-record.md` outside the repository. Real Windows build/MSI execution, clean-machine installation and remote release creation remain unverified. Integrated diff manually inspected; no external state changed.
- No production, provider, repository visibility or secret changes. Rollback: revert this task patch. Changes remain uncommitted in the assigned task checkout.

## ADR-0010 status alignment — 2026-10-27

- Verified the supplied finding: `15_ADR_INDEX.md` records ADR-0010 as ACCEPTED (2026-10-22, task P0-01), with a rationale for Tauri `bundle.resources` map form and bundled VC++ runtime. Current `tauri.conf.json` agrees. The stale PROPOSED restriction conflicted with that accepted decision; this task resolves the documentation conflict without changing the ADR or application behavior.
- Aligned the operating rule, README, technical design, implementation plan, task breakdown, manifest and source-audit follow-up. Moved the layout out of open decisions. Marked the initial P0-01 finding and prior conflict reports as superseded while preserving the decision rationale and historical evidence.
- Redistribution rights/notices, clean-machine engine launch/dictation verification, the Linux gate before Linux publication, and owner release approval remain required. Acceptance alone does not establish release readiness.
- Task checkout/worktree: `repos/github.com/eysrbs4zghuw3gmfzb2/soravo_electron`; assigned branch `coderabbit/align-adr-0010-status/ca3e3e92`; base `3029944856e698ede53154bc243d9ebfc0d867c6`. The isolated cloud checkout is the sole registered worktree, initially clean, and is retained for review; no integration performed.
- Skills: loaded `code-review` for diff review. Rust/Tauri, security and deployment skills were considered unnecessary for this documentation-only status correction. No knowledge-base directory is present. The task is small and sequential, so no subagent was needed.
- Validation: engineering-pack CI validator passed (35 documents); bounded ADR/status, manifest, configuration-agreement and gate-preservation assertions passed; `git diff --check` and manual diff inspection passed. Results and input identities are recorded in `workspace-context/validation-record.md` outside Git. No provider, production, credential or repository setting changes. Rollback: revert this documentation patch.
## 2026-10-27 — Auth test CORS review fix

Confirmed missing CORS handling in `website/e2e/auth.spec.ts`. All six Supabase mocks now share headers for the configured Playwright origin, GET/POST/OPTIONS and SDK request headers; OPTIONS returns 204 before the existing response. Application contracts and auth response fixtures are preserved. Task checkout: `repos/github.com/eysrbs4zghuw3gmfzb2/soravo_electron`; branch `coderabbit/auth-test-cors-preflight/73226cf9`; base `15dff3c59e870f797705ff7142c7495482e102ea`. Retained the runtime-provided isolated checkout; no integration performed.

Skills: loaded `code-review`; Playwright, Supabase and security skills unavailable in declared directories/catalog. Small sequential task, no delegation. Validation: auth Playwright 7/7, direct route harness 12/12, website typecheck/build passed. The original unit-test command expanded an unquoted shell glob and found no tests; the quoted-glob rerun passed all 48 tests and is recorded in `workspace-context/validation-record.md` outside the repository. No live services, credentials or production changes.

### 2026-10-27 — Delivery conflict resolution

Merged remote head `5c34e97bf0d04c4716c9b4af9c6e49a18c6bd433` into task commit `9e48ed2` on `feature/supabase-resend-auth-e2e`. Retained remote JSON mock helper, CORS methods, unit-test script and password recovery changes; retained typed Route handling and Supabase API version header allowance. Fresh checks passed: auth browser 7/7, route harness 12/12, unit tests 48/48, website/spec typecheck and build. No push performed.


## 2026-10-27 — P3-04/P2-06 recovery visibility review (87c71ff9)

Reused isolated checkout `/home/vercel-sandbox/workspace/repos/github.com/eysrbs4zghuw3gmfzb2/soravo_electron`, branch `coderabbit/verify-password-recovery-state/87c71ff9`, base `260ff874d256694cdd607c0703617cb0b13375ef` (sole named Git worktree, initially clean). The finding was partly addressed: AuthProvider already retains recovery identity in memory and restores saved identity. Fixed remaining loading and missing-ID gaps, removed unused page tracking, and preserved recovery with unavailable storage. Baseline regression run had 3 failures; final website suite 63/63, typecheck/build and recovery browser smoke 1/1 pass. Skill: code-review loaded; repository Supabase/security/React/Playwright skills unavailable; small sequential fix used no subagents. Evidence/input hashes: workspace-context/validation-record.md outside checkout. Uncommitted changes ready for delivery; no integration or remote changes.


## 2026-10-27 — P2-06/P3-04 recovery initialization gate (7804fa0e)

Confirmed the supplied finding against HEAD and auth-js 2.118.0: initialization schedules PASSWORD_RECOVERY after resolving and returns only an error, so INITIAL_SESSION or the restoration finally block can expose an invalid-link state prematurely. Keep token-bearing recovery callbacks loading until the event records identity; release loading on initialization/session errors, missing identity or sign-out. URL hints never authorize recovery. Five new cases cover deferred hash/query recovery and failure completion; baseline reproduced two failures, final targeted tests 36/36, website suite 68/68, typecheck/build pass. Auth browser suite 7/7 passed; manual diff/security inspection and git diff --check passed. Exact input hashes: workspace-context/validation-record.md outside Git.

Retained the runtime-isolated sole task checkout `repos/github.com/eysrbs4zghuw3gmfzb2/soravo_electron`, branch `coderabbit/fix-password-recovery-loading/7804fa0e`, base `cfb565df8ce325c834c79ced3f66ec329fddb30b`; initially clean, no integration performed. Skills: code-review loaded; Supabase/security/React/Playwright skills unavailable in declared directory/catalog. Small sequential task, no delegation. Existing recovery identity, storage and invalid-link contracts preserved. No provider state or credentials used. Base CI was green; patch CI has not run. Rollback: revert this scoped patch.
## API and recurring subscription review fixes — 2026-10-27

- Isolated runtime task checkout/worktree: `repos/github.com/eysrbs4zghuw3gmfzb2/soravo_electron`; assigned branch `coderabbit/api-subscription-hardening/8b15d30d`; base `74ec17eae3f6dbe0840b2766cdcfb5d08ac4e00a`. Retained for review; no commit, push or integration performed.
- Verified each supplied finding against the baseline. Removed seven API aliases; current callers/tests already use canonical exports, so no import edits were needed. Existing entitlement/subscription guards and created-ID reuse were already implemented; moved those checks into a serialized database reservation before external creation, repairing the remaining concurrency gap.
- Additive migration 004 provides a private checkout reservation and common atomic event-time upsert for lifecycle and captured-payment subscription metadata. Unknown provider outcomes retain their reservation until reconciled; definitive rejection/pre-create failure releases it. Provider correlation notes and the README describe recovery. New cancellations can be recorded before the checkout row is saved; terminal statuses win same-second ties and undated events cannot overwrite dated state.
- Skills: loaded `code-review`. Supabase/Postgres and security skills considered but unavailable in the declared local skill directory/session catalog; followed existing contracts and explicit database authorization checks. An isolated-file subagent removed the aliases and independently examined the concurrency/ordering design; the primary agent integrated, inspected and validated all changes.
- Initial validation passed: website typecheck/build and 57 tests; disposable PostgreSQL 18.6 replay and 69 pgTAP assertions; overlapping-session checkout and stale/equal-time event tests. Final permissions checks and integrated review are recorded below after completion. Detailed identities and commands: `workspace-context/validation-record.md` outside Git.
- Intentional compatibility change authorized by this request: seven alias names are removed; canonical API behavior remains. Existing commercial/device/paid-entitlement policies are preserved. Apply migration 004 before deploying the handlers. No production state/provider configuration changed. Deno deployment and live provider traffic remain unverified. Rollback application changes together with migration deployment planning; do not remove unresolved reservation data.

- Final validation: 57 valid Vitest tests (27 affected handler tests rerun after the correlation-note edit; 30 unaffected results reused), browser typecheck/build passed; clean migration replay and all 74 pgTAP assertions passed, plus three concurrent PostgreSQL-session scenarios. Manual integrated security review completed, fixing service-role filtered-delete privileges and equal-time metadata enrichment before final verification. `git diff --check` passed. Disposable database stopped. No selected local checks outstanding; changes remain uncommitted.

## P2-12 subscription ordering review follow-up — 2026-10-27

- Isolated cloud task checkout/worktree: `repos/github.com/eysrbs4zghuw3gmfzb2/soravo_electron`; assigned branch `coderabbit/harden-subscription-event-ordering/d316d0d5`; base `74ec17eae3f6dbe0840b2766cdcfb5d08ac4e00a`. Retained with uncommitted changes for review; no integration performed.
- All six supplied findings confirmed and fixed. PricingPage clears captured constructor options and runs RTL cleanup. Checkout fails with 502 on guard read errors; pending/resumed join existing billable statuses in both lookup paths and the unique index. Only created checkout sessions are reused.
- Subscription status updates check read errors and enforce the event watermark atomically; zero-row writes finalize as processed/stale_event. Grant metadata uses insert-with-conflict handling and conditional updates. Stale grants can only extend current_period_end, preserving cancellation/status/watermark. Unknown timestamps can no longer overwrite an ordered status; equal timestamps retain the baseline acceptance rule. Authoritative captured-payment provisioning remains unchanged.
- Migration 004 replaces the index transactionally on existing installations; migration 003 handles fresh installations. Existing duplicate billable rows cause the upgrade to fail without dropping the old guard; resolve such data before applying it. Database CI applies the upgrade and runs the new uniqueness tests.
- Skills: code-review loaded; Supabase/Postgres/security skills considered but absent from repository-adjacent directory/session catalog. Knowledge-base directory unavailable. A read-only subagent independently checked baseline contracts and final changes. Primary agent performed all edits and executable checks.
- Validation: website typecheck/build and 72 Vitest tests passed. PostgreSQL 17.11 with synthetic Supabase bootstrap/pgTAP passed 46 SQL assertions, then 7 guard assertions after upgrading the original predicate. Detailed commands/content hashes live in `workspace-context/validation-record.md` outside Git. Handlers use synthetic PostgREST/Auth/provider fixtures and real Supabase query builders; Deno deployment/live providers and remote CI were not exercised. Production configuration and data were untouched. Rollback: revert this patch before deployment; deployed index rollback requires a separate reviewed migration.

## Delivery merge for subscription hardening — 2026-10-27

- User authorized merging remote head `147fd3377295ff7df7009c088d3d8dea4d52f24a` into the runtime delivery branch `feature/razorpay-recurring-sandbox` at local task commit `96a7866`. Shared base `74ec17eae3f6dbe0840b2766cdcfb5d08ac4e00a`; same isolated checkout/worktree. Both parent histories and their progress/audit records are retained. No push is authorized or performed.
- Kept the atomic checkout reservation, alias removal, provider correlation/recovery and terminal-wins event ordering. Incorporated remote pending/resumed billable guards, lookup failure 502 responses, legacy race recovery, stale-event ledger/response diagnostics, metadata error logging and PricingPage test cleanup. The remote stale-capture contract allows only monotonic paid-period enrichment while preserving status/watermark; the common atomic RPC now implements that behavior, with direct SQL regressions and all remote handler scenarios retained.
- Kept the remote existing-install index upgrade as migration 004; renumbered the undelivered reservation/event migration to 005. CI and current README apply through 005. Earlier local handoff entries referring to the atomic migration as 004 describe the pre-merge patch; this section supersedes those deployment instructions.
- Validation: fresh website typecheck/build and all 85 Vitest tests passed; fresh schema and original-003 upgrade paths passed all 87 pgTAP assertions. Duplicate billable rows intentionally rejected migration 004 while retaining the old index transactionally. Three overlapping PostgreSQL session scenarios passed. An early test attempt ran before test conflict resolution and failed; the corrected merged suite passed. Exact input identities/commands are in the external validation record.
- Skill selection unchanged from the task: code-review already loaded; unavailable Supabase/Postgres/security skills not claimed. A read-only subagent compared both contracts and reviewed the integrated merge; primary agent owns conflict resolution and executed validation. No provider, production, dependency or desktop configuration changes. Deno/live provider/remote CI remain unverified. Merge commit is prepared locally for automatic delivery; no push.

## Subscription insert error review follow-up — 2026-10-27

- Isolated runtime task checkout/worktree: `repos/github.com/eysrbs4zghuw3gmfzb2/soravo_electron`; branch `coderabbit/fix-subscription-insert-errors/969be6a5`; base `f45731b86f01481601426ed7c12f85feedfa4907`. Retained for review; no commit, push or integration performed.
- The checkout finding is partially current: failed saves already return HTTP 500, but provider compensation was missing. Added immediate cancellation attempts only for non-23505 save failures, retaining the HTTP failure and reconciliation reservation even if cancellation fails. The 23505 race path is unchanged. Existing README reservation/reconciliation and entitlement contracts are preserved.
- Skipped the webhook finding as stale: the cited insert/duplicate lookup branch was replaced by `apply_subscription_event`. Migration 005 handles the provider-ID conflict atomically; unrelated insert errors propagate through the RPC's error result. Post-grant metadata error logging retains its existing behavior. A read-only subagent independently verified this disposition; the primary agent inspected code and ran validation.
- Skills: loaded `code-review`; Supabase/Postgres/security skills considered but unavailable in the declared repository-adjacent directory/session catalog. Used existing contracts and official Razorpay cancellation API documentation. Root `AGENTS.md` and the engineering-pack reading gate applied; only additional knowledge-base or repository-adjacent/session catalog guideline files were absent.
- Validation: website typecheck/build and 88 Vitest tests passed, including cancellation success, HTTP rejection and network exception, no successful checkout payload after save failure, reservation retention and unchanged legacy races. Fresh migration replay and all 87 pgTAP assertions passed on disposable PostgreSQL 16; manual diff/security inspection confirmed compensation stays inside the authenticated monthly checkout error path, logs no provider payloads/secrets, and preserves the 23505 branch and reservation contract. Detailed checks are tracked in `workspace-context/validation-record.md` outside the repository. Installed missing website dependencies using the unchanged lockfile.
- No schema, dependency version, provider configuration or production state changes. Provider calls use synthetic fixtures; Deno deployment and live cancellation remain unverified. Rollback: revert this patch.

## Checkout lookup and locking review fixes — 2026-10-27

- Isolated runtime task checkout/worktree: `repos/github.com/eysrbs4zghuw3gmfzb2/soravo_electron`; assigned branch `coderabbit/harden-checkout-error-handling-locking/c935e5b0`; base `f45731b86f01481601426ed7c12f85feedfa4907`. Retained for review; no integration performed.
- All three supplied findings confirmed. Initial and both retry plan lookup paths now log query error code/request ID and return 502 before further provider creation. Subscription creation failure logs include the reservation request ID. Migration 005 uses a per-user transaction advisory lock and a plain Auth user existence check, preserving `Unknown user` and existing checkout reservation/reconciliation guarantees.
- Regression coverage: initial/retry plan query failures, provider status/request ID logging, reservation release/retention and unknown users. Website typecheck/build and 91 Vitest tests passed; fresh migrations 001–005 and 88 pgTAP assertions passed on disposable PostgreSQL 18.6. Overlapping SQL sessions verified advisory serialization, independent-user progress, concurrent non-key Auth updates, and release on commit/rollback. Detailed commands/input hashes: external `workspace-context/validation-record.md`.
- Skills: loaded `code-review`; Supabase/Postgres/security skills unavailable in repository-adjacent/session paths. Knowledge-base absent. Small sequential repair performed in the existing isolated task checkout. Manual diff/security review found no secret exposure or authorization/entitlement changes. Provider responses use synthetic fixtures; live providers, Deno deployment and remote CI are unverified. Rollback: revert the patch before deployment; existing deployed databases require separately applying the revised function definition.

## Delivery merge for subscription insert compensation — 2026-10-27

- User requested merging remote head `b645e8246c4089c9ca6f73bdc9a25b0d577e884f` into local task commit `d8d7ec4a8d49b05d575e22976d66a76f4d182867` and committing locally without pushing. Shared base: `f45731b86f01481601426ed7c12f85feedfa4907`. Runtime delivery branch: `feature/razorpay-recurring-sandbox`; same isolated checkout/worktree `repos/github.com/eysrbs4zghuw3gmfzb2/soravo_electron`.
- Resolved both documentation conflicts by retaining both parent entries in full. Verified automatic source/test merges against both parents: remote plan lookup failures, correlated logging, per-user advisory lock and unknown-user assertion coexist with local cancellation compensation, HTTP 500, retained reservations and unchanged 23505 race handling. No additional application behavior changes.
- Validation: all 30 merged checkout tests passed freshly; 64 unchanged tests and website typecheck/build results reused after matching relevant source/config/dependency/runtime inputs. Fresh PostgreSQL 16.15 migration replay and all 88 pgTAP assertions passed. Both-parent content preservation, manual integrated review and whitespace checks passed; a read-only subagent independently checked the source/test merge. Detailed input identities/results remain in the external workspace validation record.
- Skill selection from the original task retained. Both parent histories are preserved in the merge commit. No push, production/provider changes or deployment performed. Disposable database and task-owned Docker daemon stopped. Live cancellation, Deno deployment and remote CI remain unverified.

## Cancellation deadline and guideline audit follow-up — 2026-10-27

- Both supplied findings confirmed. Corrected the earlier guideline audit to acknowledge root `AGENTS.md` and the engineering-pack reading gate. Added a five-second abort deadline to cancellation after a non-23505 subscription save failure, with timer cleanup in `finally`. HTTP 500 and reservation retention for reconciliation remain unchanged, including after timeout; legacy race recovery is preserved.
- P6-03/P6-08 follow-up in isolated runtime checkout `repos/github.com/eysrbs4zghuw3gmfzb2/soravo_electron`, assigned branch `coderabbit/bound-cancellation-and-update-audit/8e133da2`, base `10da4424140e30beb80ed5361a81f904c4d4da52`. Small sequential repair; no delegation. Skills: loaded `code-review`; Supabase/Postgres/security skills considered but unavailable in the declared repository-adjacent/session catalog. Root guidance and pack reading gate applied; additional knowledge-base guidance absent.
- Validation: 31 checkout tests and all 95 website Vitest tests passed; website typecheck/build passed. The new stalled-provider test checks the deadline, HTTP 500, retained reservation and blocked retry. An initial global timer-count assertion counted unrelated Supabase SDK timers and was removed; the corrected suite passed. Manual diff/security inspection and whitespace checks passed. Exact inputs and commands are in external `workspace-context/validation-record.md`.
- No schema, dependency version, provider configuration or production changes. Live cancellation and Deno deployment remain unverified. Checkout retained for review; no commit, push or integration performed. Rollback: revert this patch before deployment.

## P7-08 owner-only admin dashboard (2026-10-30)
Worktree .worktrees/P7-08-admin-dashboard-owner-only, branch feature/P7-08-admin-dashboard-owner-only, base 329316e. Implementation above. Owner bootstrap remains unperformed pending approval.

## P7-08 admin dashboard hardening (2026-10-30)
Worktree .worktrees/P7-08-admin-hardening, branch feature/P7-08-admin-dashboard-hardening, based on ffeature/P7-08-admin-dashboard-owner-only (8ee01ad). Reused existing admin dashboard. Added hardened overview metrics, robust admin user search pagination, approved owner self-grant constraint, Vitest and Playwright coverage, DB workflow update. Verification: 130 website Vitest tests passed; 3 Playwright admin tests passed; typecheck and build passed. Owner bootstrap and preview deployment remain pending owner approval.

## P7-08 re-orientation / CI-ready state (2026-10-30)
Branch: feature/P7-08-admin-dashboard-hardening
SHA: 8cb006d1b8d91bef6013e0ad583d9e6eec10f9d9
PR #38 state: OPEN, mergeable, not merged. GitHub checks: all required checks success at final SHA; CodeRabbit review in_progress.
No merge, deployment, bootstrap, or privilege grants performed.

## P7-08 admin dashboard follow-up (2026-10-30)
Worktree .worktrees/P7-08-admin-hardening, branch feature/P7-08-admin-dashboard-hardening.
Start SHA: 0ab690e10ace99fe5c2378ced2a16ef5f65a966f.
End SHA: d828e4bef136693d8f665f8402183f06b4da4b0f.
PR #38.
Scope: Edge Function duplicate-device repair, fail-closed audit policy, search debouncing, typed admin API helper, pgTAP assertion repair, bootstrap documentation, Edge Function CI gate.
Verification: 130 website Vitest tests passed; 3 Playwright admin tests passed; typecheck/build passed; Deno check passed.
Remaining: GitHub Actions database verification, CodeRabbit findings, owner bootstrap and preview deployment.

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:4474a8696de9975950b731b41e95cf707e36aa1ebdf3b8c0120fc3f264c2dbdd -->

## P7-08 readiness repair round 1 — 2026-10-30

- Expected/input head: `4052f9ba9c2d7dea88a9821aa198c2027f320a12`. Worktree: runtime-isolated `repos/github.com/eysrbs4zghuw3gmfzb2/soravo_electron`, assigned branch `coderabbit/admin-dashboard-readiness-fixes/triage_r`; initially clean, sole registered named worktree. UI/client files delegated under exclusive file scope; integrated diff reread and tested by the parent.
- Replaced capped overview row fetches with service-role-only SQL aggregate `admin_dashboard_overview()` in migration 007, preserving response fields, metric definitions, UTC day buckets, all-or-error handling and fail-closed audit writes. Apply 007 before deploying the updated Edge Function. CI now applies 007 and includes its pgTAP regression tests.
- Removed the 5,000-account search ceiling, pages filtered display-name matches independently, preserves literal substring matching/deduplication, and checks profile-search failures. Enrichment remains limited to the selected page (maximum 50 IDs); search still enumerates Auth pages because the existing Auth admin list API has no email substring filter.
- Added overview Retry and independent subscriptions/devices pagination with boundary controls. The audit-insert and anonymous-role findings were already repaired at the input head; existing fail-closed policy remains unchanged. Supplied walkthrough and Autofix status comments contain no additional actionable defect.
- Fresh validation: 28 scoped handler/API/component tests passed; PostgreSQL 16 migration replay plus 29 admin aggregate/access pgTAP assertions passed; Deno 2.5.6 check, website typecheck/build, and 3 admin Playwright tests passed. Initial SQL fixture omitted required subscription plan_code; corrected before the passing run. Playwright emitted the existing Pages redirect-rule warning; selected admin Chromium tests passed. No repository-wide or desktop checks ran. Website typecheck/build are the narrowest declared package checks. Inputs/commands are in the external workspace validation record.
- Skills: `code-review` loaded. Supabase/Postgres/security/React/Playwright skills were considered but unavailable in the declared adjacent path/session catalog; current repository conventions and direct security/access checks used. Knowledge-base locations absent. Manual integrated diff and security inspection completed.

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:0800ec55965fb99240925f9bd4d2fc6916a24c5884d704acd5e609ddf48cec47 -->

- Remote branch and PR head refreshed and still matched the expected head after validation. Required remote CI/review policy on the published repair remain unverified; no publication, comment mutation, deployment, bootstrap or provider data/configuration change performed. Host owns publication and final review-thread handling.

## P7-08 readiness repair round 3 — 2026-10-30

- Input head `ca48d47231a2ca76526a8fd9a9bc0adee5a29bcd`. Fixed the earlier worktree inventory, separated section reloads from overview retries, and cleared stale section errors on new requests.
- Migration 008 adds a service-role-only search RPC. Matching remains literal, case-insensitive, deduplicated, and email-first; within each group it now uses creation time and ID for stable pagination, which can change page placement. Exact totals still require database-wide match counting. Apply migration 008 before the updated Edge Function.
<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:67aeb90d8407e3e0c9b3dcccd070b4111b29e2b65a89062df7830b2b4d2ade88 -->

- Scoped verification: 32 handler/API/UI tests, PostgreSQL 16 migration replay and 132 database assertions, website typecheck/build, Deno check, and 3 admin Chromium tests passed.

<!-- /coderabbit-ai-generated:v1 --> The first browser run required installation of Chromium; the passing rerun emitted the existing Pages redirect warning. No live Supabase integration or current-head remote CI/review policy was verified. Exact evidence is in `workspace-context/validation-record.md` outside Git.


<!-- /coderabbit-ai-generated:v1 -->


<!-- /coderabbit-ai-generated:v1 -->
## 2026-10-30 � P7-08 CodeRabbit test mock findings

- PR: 38
- Branch: feature/P7-08-admin-dashboard-hardening
- Findings:
  - A bearer-token validation added to the Supabase Auth user mock.
  - B mock default page size changed to 50.
  - C Link headers include rel="last" for final/single/empty pages.
- Files changed: website/supabase/tests/admin_dashboard.test.ts; progress.md
- Validation: npm test (167 passed), typecheck 0, build 0, deno check 0, local CodeRabbit 0 findings.
- Code commit: 3bd46bc5f27663fccf8e67f1647c2c20c408b7ba
- Push status: pushed.
- PR #38 remains open and unmerged; no deployment performed.

## 2026-10-30 � Backend admin deployment to Soravo_fresh

- Target project: Soravo_fresh (vfrhplskegqqdxbykyvx)
- Migrations 006/007/008 applied successfully; history recorded above.
- admin_users count: 0. No owner/admin account created or granted.
- admin-dashboard Edge Function: version 1, ACTIVE, verify_jwt true.
- Other functions unchanged.
- Smoke tests passed (OPTIONS 200, unauth 401, invalid JWT 401).
- Cloudflare preview https://ad8df800.soravo-web-preview.pages.dev/admin returned 200.
- PR for this change: pending.

