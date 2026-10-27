# Soravo Engineering Pack — Fresh Commercial Release Edition

**Status:** Planning baseline, version 1.0  
**Product repository currently observed:** `eySRbS4zgHuW3gMFZB2/soravo_electron` (public at time of audit)  
**Intended active repository name:** `soravo` if the old repository can be renamed to `soravo_deprecated` first; otherwise use `soravo_tauri` temporarily.  
**Product framework:** Tauri v2 + Rust + React + TypeScript + Vite  
**Commercial scope:** Website, accounts, subscription/lifetime entitlements, user/admin dashboards, Razorpay, releases and downloads.

This pack is newly authored for the current Tauri application. It does not import the old repository's implementation, schemas, architecture, code, or Handy-fork-specific directions. The old repository may be consulted for two purposes only: as a historical record of the owner's requested documentation discipline, and as a **behavioral and content reference for approved website content and behavior** (the approved Phase 3 reference — page structure, pricing presentation, dashboard behaviors). Neither use permits porting its implementation, schema, migrations, Edge Functions or desktop code. The current app repository is the implementation source of truth.

## Read this first

1. Read `01_AUTHORITY_AND_SOURCE_OF_TRUTH.md`.
2. Read `02_PRODUCT_REQUIREMENTS.md`, `03_COMMERCIAL_RULES.md`, and `04_TECHNICAL_DESIGN.md`.
3. Read `28_GIT_WORKTREE_POLICY.md` **before changing any file.** It is binding.
4. Read `07_AI_AGENT_OPERATING_RULES.md` and **run the Skill Selection Gate** in `08_SKILLS_AND_MCP_POLICY.md` before any substantive task.
5. Follow `05_IMPLEMENTATION_PLAN.md` and `06_TASK_BREAKDOWN.md`.
6. Before touching secrets, read `11_ENVIRONMENT_AND_SECRETS.md`.
7. Before touching auth, licensing, payments or admin, read `10_SECURITY_BASELINE.md`.
8. Every task must follow `07_AI_AGENT_OPERATING_RULES.md`, `08_SKILLS_AND_MCP_POLICY.md`, and `09_GITHUB_CI_POLICY.md`.
9. At the end of every work session, update `18_PROGRESS_AND_HANDOFF.md`, `19_STATE_AUDIT_PROTOCOL.md`, and relevant ADRs.
## Important source-checked baseline

The public GitHub repo was inspected on 2026-10-22. Observed files include `README.md`, `AGENTS.md`, `DESIGN.md`, `MODELS.md`, `progress.md`, `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`.

- The app is Tauri v2, React 18, TypeScript, Vite, Rust, SQLite, and `tauri-plugin-store`.
- Current repo name `soravo_electron` is stale branding; it is not evidence the current application is Electron.
- `package.json` name is already `soravo`.
- The README and progress history disagree in places about Whisper vs CrispASR. Current product decision: preserve the existing CrispASR implementation; do not switch engines as part of commercial integration.
- The checked Tauri config showed `bundle.resources: []` and `bundle.externalBin: []`. This is a **release blocker to verify**, because CrispASR and required companion files must be present in the installed application, not merely in the development tree.
  - Re-confirmed 2026-10-22: `third-party/bin/` is git-ignored with **0 tracked files** (developer-machine only, produced by `npm run fetch:asr`); the engine is **committed** at `third-party/crispasr/extracted/crispasr-windows-x86_64-cpu/`. A release build produced ~6.15 MB (MSI) / ~4.28 MB (NSIS), far smaller than the ~20 MB engine, corroborating that it is not bundled. See `23_SOURCE_AUDIT_NOTES.md` finding 3 and ADR-0010.
- Current config sets bundle targets to `all`, but that does not prove Linux builds or Linux runtime behavior are tested. Windows is the only platform with an engine artifact in the repository; **Linux is BLOCKED** until a Linux engine is obtained, licensed, tracked and bundled (task P1-05).
- The repository was public at audit time. Treat changing visibility to private as an explicit owner-operated launch-preparation task.
- The website, account system, payments and dashboards are not present in the current app implementation based on the reviewed root files; this pack plans them as new work.
- The current production site at `soravo.xyz` is served from the **historical** repository's commit via the Cloudflare Pages project `soravo`, which is deployed by direct upload rather than by Cloudflare's Git integration. This is recorded as planning context only; it is not a dependency of the new project, and the production site must remain untouched until cutover.

## Decisions recorded from the owner

Approved in the decision memo `SORAVO_DECISION_MEMO_2026-10-22.md`, which is part of this pack and is the highest authority in it, and in later accepted ADRs recorded in `15_ADR_INDEX.md`.

- **Website strategy:** rebuild the replacement website fresh in the active repository, following this pack. The historical `soravo` repository is a behavioral and content reference only for approved website pages, pricing presentation and dashboard behaviors; its implementation, schema, migrations, Edge Functions, workflows and Handy-derived desktop code are not ported. The current production site stays live and untouched until cutover (ADR-0008).
- **Repository rename order:** establish baseline CI and release-packaging checks first, then prepare the rename checklist, then rename, then verify integrations (ADR-0009).
- **Production domain:** `soravo.xyz` and its DNS and email configuration are preserved through the migration. Cutover happens only after the replacement passes its launch checklist, with a documented rollback path (`27_PRODUCTION_CUTOVER_AND_ROLLBACK.md`).
- Windows and Linux are the intended launch targets, but **Linux is BLOCKED** pending a Linux engine artifact; Windows is the only platform with an engine today.
- $12/month recurring subscription.
- $50 lifetime license.
- Enterprise is deferred; a "Contact us / coming later" placeholder may exist but must not imply purchasable entitlements.
- Monthly license device cap: 3 active devices.
- Lifetime license: unlimited devices and can operate offline indefinitely.
- Browser-based desktop sign-in with a secure deep-link return.
- Website is a separate app under `website/` in the same repository; independent package/lockfile and build.
- Cloudflare Pages for website hosting.
- Supabase Auth/database; Resend as Supabase custom SMTP.
- Razorpay for payments.
- **Backend function placement** (ADR-0003): ACCEPTED. Supabase Edge Functions handle privileged APIs; Cloudflare Pages hosts the static website. Task P2-08 is decided.
- **Binary distribution host** (ADR-0005): ACCEPTED. The separate public `soravo-releases` repository hosts artifacts only. Remaining publication gates: clean-machine verification, the Linux release gate when publishing Linux artifacts, and owner approval of each release.
- **CrispASR bundled layout** (ADR-0010): ACCEPTED (2026-10-22, task P0-01). Use Tauri `bundle.resources` map form with bundled VC++ runtime; see the ADR for tracked source paths, resource destinations and rationale. Redistribution checks and clean-machine release verification remain required.
- Admin dashboard guarded by Supabase Auth plus a server-verified role.
- Cloudflare Web Analytics as the first visitor analytics source.
- Subscription expiry: grace period then disable paid features while retaining/exporting user data.
- Current CrispASR engine remains in place.
- GitHub Actions should be used extensively while the repository is public.
- Code signing budget is zero; publish SHA-256 checksums. Be transparent that checksums do not prove publisher identity and self-signing does not remove SmartScreen warnings.
- Do not import implementation or schemas from the old repository.

## Decisions still open (do not implement as settled)

None for the ADRs listed above. Accepted decisions retain their implementation and release gates.

## Mandatory policies

- **Git worktrees** (`28_GIT_WORKTREE_POLICY.md`): every new feature and every independent task runs in its own dedicated worktree and named branch. One task, one worktree, one branch. Tasks never touch another worktree's files, branch, index or stash. Tests and review happen in the worktree before integration. After merging, the worktree and its build output are removed.

## What this pack does not do

It does not change GitHub repository names, visibility, branch protections, local folders, Cloudflare, Supabase, Resend or Razorpay. It does not claim the services have been configured. Those actions require the owner to execute or explicitly authorize them.
