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

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:9a9122134d107a17386457f46bbe3627ad234a0defea44e7f196693f7ddc4269 -->

## Desktop authentication review-fix audit — 2026-10-31

- CONFIRMED: initially clean assigned checkout on `coderabbit/changes/8fe5a4cb`, base `2e8f7e534a9e5bb858a3eb1341bab154c0a025fb`; no separate worktree was created. All four reported issues were present. Existing accepted desktop key filenames are preserved.
- CONFIRMED: renderer build and focused secure-store test passed. Full Rust suite: 39 passed, 1 failed in unchanged Windows-specific Caps Lock logic on Linux. Windows DPAPI and authenticated desktop UI were not exercised. Existing sign-out does not remove the separate stored desktop session.
- Skill selection: CodeRabbit review skill loaded; Rust, Tauri, Supabase and security specialist skills were unavailable. Progress and handoff files could not be updated by the Markdown helper because their existing content is not UTF-8.

<!-- /coderabbit-ai-generated:v1 -->

## Windows browser-to-desktop authentication repair — 2026-10-31

- CONFIRMED at base `a86ed22acbaeb3f52920164760fc111ff68546ba`: hub deep-link registration was late, callback paths were not deduplicated/serialized, session hydration could overwrite later auth events, and secure-storage read failures appeared as signed-out.
- FIXED on task branch `fix/SORAVO-DESKTOP-AUTH-REPAIR-30-desktop-auth` (planning commit `ded4df5f8b9d72e3293825f37956c6009f5aa375`): early callback broker, validated PKCE transaction, session restore guard, DPAPI error propagation, terminal pending cleanup, matching magiclink verifyOtp, browser refresh before issue.
- CONFIRMED: conditional handoff delete is intended atomic single use; no local Postgres available to test actual concurrent exchanges. Edge handler tests use a mock contract.
- INFERRED: callback delivery and session hydration races plausibly explain intermittent return-to-app behavior; no live session test establishes root cause.
- PASS: app typecheck/build; website typecheck/build; focused handler/contract tests 13/13; website unit suite 130/130 before handler extraction and focused suite 13/13 after; diff whitespace check.
- BASELINE FAILURES: four auth Playwright form cases fail because `website/e2e/auth.spec.ts` mocks port 5173 while configured web server is 5174; mismatch exists at base. Three desktop route tests passed; real credential test skipped.
- BLOCKED/UNVERIFIED: Windows native app runtime, DPAPI restart persistence, hosted handoff, and actual DB concurrency; no local Supabase/Deno/Postgres, and remote writes were out of scope. Rust tests could not complete because of linker/compiler environment mismatches; no result claimed. CodeRabbit review pending.
- CONTRACT DECISION: document `29_WEB_DESKTOP_AUTH_CONTRACT.md` specifies 60-second handoff but existing deployed code uses 120 seconds; implementation preserves existing lifetime pending separate owner decision.

### Validation addendum — 2026-10-31 (supersedes earlier status above)
- PASS: Rust `cargo test --lib` on MSVC 1.90: 38/38; desktop typecheck/build PASS; website typecheck/build PASS; full website unit suite 136/136; focused desktop handoff/contract tests 15/15; Playwright Chromium auth suites 13 passed / 1 skipped (real credential flow skipped). The Playwright rerun includes the fixed 5174 origin and password-recovery `returnTo` check. `git diff --check` PASS.
- PASS: `npm run tauri:dev` finished compiling and launched `src-tauri/target/debug/soravo.exe`; the native window rendered signed-out actions. The existing stored pending transaction rendered an expired-request status. UI automation could not capture the window after initial accessibility state due Windows.Graphics.Capture failure; no native sign-in click or live callback is claimed.
- Implemented then removed after security review: code-less background polling was vulnerable to an attacker-chosen PKCE verifier on a crafted auth URL. Final flow requires the authenticated browser user to select “Continue to Soravo”, then “Open Soravo”. Browser session refresh/retry and signup/login recovery/reset return routing remain in place. The Edge handler supports issue and exchange only.
- REVIEW: The previous CodeRabbit review identified the code-less polling risk; the final security addendum records its removal. Current integrated-diff review is pending.
- NOT ACCEPTED as full live handoff: the supplied test account completed browser login and reached desktop-auth confirmation, but no handoff was issued and the security-fixed function/config are not deployed. Hosted handler runtime, database single-use concurrency, and native deep-link completion remain unverified.

### Final security and validation addendum — 2026-10-31 (supersedes prior polling status)
- SECURITY: CodeRabbit identified an account-takeover path in code-less state polling: a crafted desktop-auth URL could bind a victim's browser session to an attacker-chosen PKCE verifier. Removed polling completely from the renderer and Edge handler. Browser handoff issuance now occurs only after the authenticated user clicks “Continue to Soravo”; the one-time code is then exchanged only through the app's stored state/verifier and explicit Soravo protocol callback.
- DECISION: clickless desktop completion after website login was removed because it made a transferable victim token retrievable by a caller who chose the challenge. The user must confirm the desktop handoff in the authenticated browser and then accept the browser's Open Soravo prompt. This is an intentional security requirement.
- PASS: Rust `cargo test --lib` 38/38; desktop and website typecheck/build; website unit suite 135/135; focused contracts 14/14; Playwright Chromium auth suites 14/14 with supplied test credentials, including live login, desktop return, and no handoff before user confirmation.
- PASS: Rust `cargo test --lib` 38/38 earlier in this task; `git diff --check` pass. Tauri dev runtime built and launched earlier; initial accessibility tree rendered. Native screenshot/input automation failed on Windows.Graphics.Capture, so no desktop click/deep-link acceptance is claimed.
- NOT ACCEPTED as live full handoff: latest Edge handler/config are not deployed, and no hosted handoff was issued. The real credential run deliberately stopped before “Continue to Soravo” to avoid exercising a stale deployed function. No actual app deep-link callback against the hosted backend or DB concurrency test was performed.
- REVIEW: a final CodeRabbit review of the security-fixed diff is running; triage its completed findings before integration.

### Fixed-redirect handoff addendum — 2026-10-31
- Supabase email confirmation and recovery now use static exact callback paths (`/auth/desktop-confirm`, `/reset-password`); sanitized `returnTo` stays in same-origin local storage and is consumed after confirmation/reset. Local `supabase/config.toml` lists exact localhost URLs only. Hosted Auth URL configuration still needs the corresponding exact production paths; no wildcard redirect was added.
- Final credential-backed Playwright pass: 16/16. Website typecheck/build and 135 Vitest cases pass; focused handler/contract tests 14/14. Real password login against the supplied test project returns to desktop confirmation and does not issue a handoff until user confirmation.
- Remaining production acceptance: deploy the security-fixed Edge Function/config and add the exact hosted Auth redirect URLs, then run issue/exchange with the test account and exercise the Soravo OS callback. No hosted change or handoff was made.

### Deployed handoff compatibility fix — 2026-10-31
- Found the live `desktop-auth-handoff` Edge Function is version 1 and its successful exchange response contains `token_hash` and `state` but omits `otp_type`. The desktop client required that field, so it discarded a valid callback after consuming the code. The deployed function issues only `magiclink` tokens.
- Updated the desktop response parser to infer `magiclink` only when `otp_type` is omitted; any explicit unexpected type still fails validation. Added coverage for legacy omission, explicit type, and malformed payloads.
- PASS: desktop typecheck/build; website typecheck/build; website unit suite 138/138; diff check. Native callback retry not completed because Windows Graphics Capture/input failed on the app window; user can retry sign-in with the rebuilt hot-reloaded app.
- Windows/browser protocol prompts are controlled by the registered handler and browser consent state; the callback reached Soravo in the reported attempt, so the missing prompt was not the cause of the failed desktop session.
- Code review follow-up: moved `pg_cron` scheduling out of migration replay into `website/supabase/operations/cleanup_expired_desktop_auth_handoffs.sql`, which is run once in hosted Supabase; migrations 009/010 are now replayed by database CI without requiring `pg_cron` in the plain PostgreSQL service. Database migrations could not be exercised locally (no psql/Docker); CI will verify replay.
- PR #41 review follow-up: explicitly pin Supabase's current default session-storage key and use that same key for fallback cleanup, preserving existing stored sessions; fixed the Windows-safe root test glob and documented the separate Deno check for the Edge Function.
- PASS after that follow-up: root sign-out regression test 1/1, desktop typecheck/build, website typecheck/build, website Vitest 138/138, and diff check.
