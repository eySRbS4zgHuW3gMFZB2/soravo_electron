# Soravo State Audit Records

## Bounded review-fix audit - 2026-10-24

- CONFIRMED at `1ae7c4c402d11ee2f9f41dea9c2c5c88299a3aa3`: isolated assigned task checkout/branch, initially clean, sole registered worktree. Latest remote Website CI, CI and Packaging baseline runs succeeded; these results precede this patch.
- CONFIRMED: all four supplied auth/signup/device diagnostics findings were still present and repaired with no payment, entitlement, authorization or response contract changes.
- CONFIRMED: Node v24.21.0, npm 11.19.0; website lockfile dependencies installed successfully. Deno is unavailable, so device-handler behavior is checked through a temporary Node harness executing the transpiled function with synthetic Deno/Supabase fixtures; deployment/runtime compatibility remains unverified.
- No provider configuration, data or production state inspected or changed. Current patch validation is recorded in `workspace-context/validation-record.md` outside the repository; completion results are appended to the session handoff.

## Bounded P2-11 review-fix audit - 2026-10-24

- CONFIRMED at `66ac18f2f0275109960f7fd192a43be0214571dc`: sole task checkout on `coderabbit/clarify-task-scopes-webhook-claims/e23753fb`, initially clean; supplied task-scope, README path and claim-fencing findings all present.
- CONFIRMED: claim/reclaim token rotation and token/state predicates now fence ledger finalization; successful finalization must return one row. Website checks passed (29 tests, typecheck, build), as did disposable PostgreSQL/pgTAP suites (17 assertions) and the final handler rerun (10 tests).
- LIMITATION: payment/entitlement side effects still lack transactional claim fencing; live provider configuration, remote CI for this patch and Deno deployment were not exercised. No external state changed. Validation inputs and commands are recorded outside Git in `workspace-context/validation-record.md`.

## Preview and release infrastructure audit - 2026-10-27

- CONFIRMED: base commit e1c7337, branch feature/preview-and-release-pipeline.
- CONFIRMED: Cloudflare preview Pages project soravo-web-preview created with root=website, build=npm run build, output=dist, env VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY set to the Soravo_fresh Supabase project (public/publishable key only).
- CONFIRMED: Supabase target identity vfrhplskegqqdxbykyvx (Soravo_fresh), not the old soravo project.
- CONFIRMED: public release repository eySRbS4zgHuW3gMFZB2/soravo-releases created and a temporary release asset downloaded anonymously with HTTP 200.
- CONFIRMED: website typecheck and unit tests (42 pass), production build (446.61 kB JS), Playwright smoke/navigation (20 pass).
- CONFIRMED: SPA deep-link fallback added via website/public/_redirects.
- BLOCKED/LIMITATION: direct Cloudflare Pages deployment upload requires credentials/UI/manual process; no deployed preview yet. Release workflow creates a draft only and requires SORAVO_RELEASES_PAT; Linux remains blocked pending clean-machine runtime gate.


## Release gates and Pages routing review audit — 2026-10-27

- CONFIRMED at `7202d2b802da2ae0751dbd28b2096f2782b6a17d`: sole registered, initially clean task checkout at `repos/github.com/eysrbs4zghuw3gmfzb2/soravo_electron`, branch `coderabbit/release-gates-and-routing/d7d742a1`. All six supplied findings were verified against current files; workflow, routing tests and bounded documentation fixes are present in this task diff.
- CONFIRMED: every emitted NSIS installer has a required extraction/content gate before staging/upload; resolved release version equals Tauri config exactly; installer names match the entire version segment; source tags must resolve to the built commit before draft creation; the source tag is verified against the built SHA, while release tags in soravo-releases target that repository's default branch.
- CONFIRMED: website typecheck/build, 42 unit tests and 29 browser tests passed (21 Vite, 8 built site through Wrangler Pages). Wrangler initially ignored the `/index.html` catch-all rewrite as a loop; rewriting to `/` passed without that warning. Pinned Wrangler 4.153.0 requires Node 22+; website CI already selects Node 22. Existing locked dependency versions are preserved.
- CONFIRMED: 63 release harness subprocess assertions passed, including real synthetic NSIS archives extracted by 7-Zip, required-file/extraction failures, exact version/filename cases, and missing, mismatched, lightweight and annotated local tags. Remote gh calls were replaced with an explicit local stub; no GitHub write occurred. Configuration verification and engineering-pack CI validation passed. Input hashes and exact commands are recorded in `workspace-context/validation-record.md` outside Git.
- Historical conflict (resolved by the ADR-0010 status alignment below): the pre-change ADR index marks ADR-0010 ACCEPTED, while the operating rule/planning records mark it PROPOSED. The explicit review request preserves the PROPOSED restriction; this patch retains it and leaves the index unchanged. ADR-0003 and ADR-0005 are consistently treated as accepted in the affected records.
- LIMITATIONS: real Windows build/MSI extraction, clean-machine runtime verification, remote release creation and remote CI for this patch were not exercised. Clean-machine verification and owner approval remain publication gates; the Linux gate applies before Linux publication. No provider, credential, production or repository-visibility change occurred.

## ADR-0010 status alignment — 2026-10-27

- CONFIRMED at `3029944856e698ede53154bc243d9ebfc0d867c6`: sole registered, initially clean task checkout on `coderabbit/align-adr-0010-status/ca3e3e92`. ADR-0010 is ACCEPTED with a recorded P0-01 rationale; current Tauri resource mappings and bundled VC++ runtime agree.
- RESOLVED: the previously recorded ADR-0010 status conflict. Current operating/planning instructions now follow the accepted ADR; original audit/plan claims are explicitly historical and superseded. The accepted ADR itself is unchanged.
- Existing redistribution, clean-machine verification, Linux publication and owner approval gates remain binding. No runtime or clean-machine verification was performed for this documentation correction. Recent remote Website CI, Packaging and CI runs succeeded at `0978025d379abbe2aa4df9b791415ecb67c8658c`; these precede this patch and do not validate it. Local checks are recorded outside Git in `workspace-context/validation-record.md`.
## Supabase Resend auth audit - 2026-10-26

- CONFIRMED at `e1c7337b6574b987296f28e6ffea386d2b755c09`: worktree `feature-supabase-resend-auth-e2e` on branch `feature/supabase-resend-auth-e2e`, initially clean.
- CONFIRMED Supabase projects: historical `soravo` (`zbzhlhoxblguepplqppw`, ap-northeast-2) and intended `Soravo_fresh` (`vfrhplskegqqdxbykyvx`, us-east-1). This workstream targets `Soravo_fresh`; no remote mutation performed.
- CONFIRMED Cloudflare zone `soravo.xyz` (`892821fa91d4050a787fee4e505918c5`) has Zoho MX/SPF/DKIM records plus `soravo.pages.dev` CNAMEs. No DNS records were changed.
- BLOCKED: Resend domain verification and SMTP credentials require dashboard access; exact Resend DNS records were not available, so no DNS writes were made. Owner action required.
## Bounded subscription review-fix audit — 2026-10-27

- CONFIRMED: initially clean isolated assigned task checkout on `coderabbit/api-subscription-hardening/8b15d30d`, sole registered worktree; base `74ec17eae3f6dbe0840b2766cdcfb5d08ac4e00a`. Existing entitlement guards and provider-ID reuse were present, but concurrent external creation and unconditional captured-event subscription upserts remained possible.
- CONFIRMED: minimal alias removal plus migration 004 move checkout checks/reservation and provider event ordering into atomic database operations. Tests cover failure retention, safe release, provider-ID reuse, cancellation before local persistence, stale/equal/undated events and role permissions.
- CONFIRMED: Ubuntu 26.04.1, Node 24.21.0/npm 11.19.0; website frozen dependency installation succeeded. Disposable PostgreSQL 18.6 with synthetic Auth bootstrap and pgTAP is used locally; CI remains PostgreSQL 16. No external account, credentials, live service or production state changed.
- LIMITATIONS: Deno deployment, live Razorpay traffic and remote CI for this patch were not exercised. Ambiguous provider creation requires operator reconciliation before a reservation is released. Detailed local validation/review outcomes are kept in the external validation record and session handoff.

## Bounded subscription-ordering review audit — 2026-10-27

- CONFIRMED: initial clean task worktree on `coderabbit/harden-subscription-event-ordering/d316d0d5`, base `74ec17eae3f6dbe0840b2766cdcfb5d08ac4e00a`; sole registered worktree. All six supplied findings were present and repaired.
- CONFIRMED: database predicates now fence status/watermark updates; stale grant metadata extends only a later paid period. Both checkout guard paths and fresh/upgrade index definitions cover pending/resumed. Pricing tests reset options and clean the DOM.
- CONFIRMED: website typecheck/build and 72 Vitest tests passed; disposable PostgreSQL 17.11 replay and four pgTAP suites passed 46 assertions; original-index upgrade passed another 7 assertions. CI uses PostgreSQL 16; that version was not run locally. Deno deployment, live provider flow and remote CI remain unverified. No production or shared provider state accessed.
- Task remains uncommitted in the assigned checkout for user review. Exact validation/input identities and task-local service cleanup are recorded outside Git.

## Subscription delivery merge audit — 2026-10-27

- CONFIRMED: clean task commit `96a7866` and remote head `147fd3377295ff7df7009c088d3d8dea4d52f24a` diverged from `74ec17e`; user requested a merge commit with both changes preserved and no push. Runtime checkout now holds `feature/razorpay-recurring-sandbox`, sole registered worktree.
- CONFIRMED: resolved all eight conflicting paths; retained both documentation histories and remote PricingPage cleanup. Atomic checkout/event migration is now 005, after remote 004's pending/resumed uniqueness upgrade. Both source and test contracts were integrated, including stale-capture paid-period enrichment without status resurrection.
- CONFIRMED: merged website typecheck/build and 85 tests passed; fresh-install and original-index upgrade paths passed 87 SQL assertions each. Upgrade rollback on duplicate billable data and overlapping checkout/cancellation transactions were verified with synthetic fixtures. PostgreSQL 18.6 was exercised; CI remains PostgreSQL 16. No live services or secrets used, and no remote CI result is claimed.
