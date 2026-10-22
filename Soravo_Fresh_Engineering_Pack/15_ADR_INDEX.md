# Architecture Decision Records (ADR) Index

Write one ADR per durable architecture choice. Use status `PROPOSED`, `ACCEPTED`, `SUPERSEDED`, or `REJECTED`. Do not edit an accepted ADR to rewrite history; create a superseding ADR.

## ADR-0001 — Preserve Tauri/CrispASR desktop
**Status:** ACCEPTED by owner  
Preserve the current Tauri v2 application and CrispASR integration. Commercial infrastructure is added around it; no engine migration in this workstream.

## ADR-0002 — Website in same repository, independent app
**Status:** ACCEPTED  
Create `website/` with its own package manifest/lockfile. Keep desktop build configuration and `frontendDist` isolated.

## ADR-0003 — Commercial services
**Status:** ACCEPTED in part; backend function placement REMAINS PROPOSED  
Accepted: Cloudflare Pages for website hosting, Supabase Auth/Postgres for identity and data, Resend for custom SMTP, Razorpay for payments, Cloudflare Web Analytics for site traffic.

**Still PROPOSED and not to be implemented as decided:** which provider hosts the privileged server-side API (Cloudflare Pages Functions/Workers versus Supabase Edge Functions). `04_TECHNICAL_DESIGN.md` previously carried a "recommended first choice"; that wording has been softened to a candidate so this ADR remains the decision point. One primary backend must be chosen and recorded here — with rationale — before implementation depends on it (task P2-08). Do not duplicate privileged business logic across two providers.

## ADR-0004 — Entitlement policy
**Status:** ACCEPTED  
Monthly $12, recurring, max 3 active devices, 14-day offline grace. Lifetime $50, unlimited devices, indefinite offline after activation. Enterprise deferred.

## ADR-0005 — Binary distribution
**Status:** PROPOSED — not final, and not to be implemented as decided  
Preferred candidate: a separate public `soravo-releases` repository containing artifacts only, so that public download links work without customer GitHub authentication while the source repository can be private. The owner asked for alternatives to any public repository, so the host is not settled. Before this ADR can become ACCEPTED it needs: an anonymous-download proof of download from a logged-out browser on a second network; confirmation that the chosen host does not require a payment card; confirmation of current file-size and quota limits from official docs; and a decision on checksum publication plus an optional minisign signature. See `14_FREE_BINARY_HOSTING_OPTIONS.md` for the option set and the decision rule. Do not start Phase 8 distribution work against this ADR while it is PROPOSED.

## ADR-0006 — Repository naming
**Status:** ACCEPTED intention, not yet executed  
Rename old repo `soravo` → `soravo_deprecated`; rename active repo `soravo_electron` → `soravo`; rename local folder. Must be done sequentially with backup and URL updates.

**Ordering constraint (added 2026-10-22, see ADR-0008):** the rename is **not** the first Phase 0 action. Baseline CI and release-packaging checks must exist and be green in `soravo_electron` before any repository is renamed, so that a renamed repository inherits working, verifiable automation.

## ADR-0007 — Keepalive
**Status:** PROPOSED  
A scheduled GitHub Action every four days may issue a trivial non-destructive database query to reduce inactivity risk. This is not a guarantee; monitor Supabase project status and notices. Avoid create/delete dummy records unless necessary.

## ADR-0008 — Website rebuild strategy and production-site preservation
**Status:** ACCEPTED  
The replacement website is built **fresh** in the active Soravo repository, following this pack. The historical `soravo` repository is a **behavioral and content reference only** for approved website pages, pricing presentation and dashboard behaviors. Its implementation, Supabase schema, migrations, Edge Functions, workflows and Handy-derived desktop code are **not** ported.

Consequence: the replacement site is not a refactor of the old one; shared identifiers, table names and API shapes may differ, and that is acceptable.

The current production site at `soravo.xyz` and its DNS and email configuration **remain in place and untouched** until the replacement passes its launch checklist. Cutover is a separate, explicitly approved, reversible step. See `27_PRODUCTION_CUTOVER_AND_ROLLBACK.md` for the cutover and rollback requirements, and `05_IMPLEMENTATION_PLAN.md` Phase 8 for the gate.

## ADR-0009 — Repository rename ordering
**Status:** ACCEPTED  
The order is: **backup and audit → baseline CI and release-packaging checks → rename checklist preparation → rename → post-rename verification.** Renaming a repository changes its URL and can break GitHub Actions secret scoping, the Pages source link, `gh` invocations, OAuth and deep-link allowlists, and hard-coded GitHub URLs in documentation and release links. GitHub's redirect behaviour for renamed repositories is **not** a guarantee that every third-party integration follows it, so each integration must be re-verified individually after the rename.

## ADR-0010 — CrispASR engine packaging source
**Status:** PROPOSED  
The engine must be bundled into the installed application from a path that is **tracked in git**. The currently committed location is `third-party/crispasr/extracted/crispasr-windows-x86_64-cpu/`; the `third-party/bin/` path that the README names is git-ignored and contains no tracked files. The exact bundled layout (Tauri `bundle.resources` mapping versus an `externalBin` sidecar versus a deliberate rename of the tracked staging directory) is **not yet decided** and must be chosen and recorded here before packaging work begins (task P1-03).

This ADR additionally records the release gate: **no release until a clean-machine install, with no developer tools and no source tree, proves the app locates and launches the bundled engine.** Redistribution rights for every bundled binary and DLL must be confirmed before bundling.

## ADR template
- Context
- Decision
- Alternatives considered
- Consequences/trade-offs
- Security/privacy implications
- Cost/free-tier assumptions
- Rollback/migration
- Evidence links/date
