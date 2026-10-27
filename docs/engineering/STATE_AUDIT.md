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

## Bounded subscription-ordering review audit — 2026-10-27

- CONFIRMED: initial clean task worktree on `coderabbit/harden-subscription-event-ordering/d316d0d5`, base `74ec17eae3f6dbe0840b2766cdcfb5d08ac4e00a`; sole registered worktree. All six supplied findings were present and repaired.
- CONFIRMED: database predicates now fence status/watermark updates; stale grant metadata extends only a later paid period. Both checkout guard paths and fresh/upgrade index definitions cover pending/resumed. Pricing tests reset options and clean the DOM.
- CONFIRMED: website typecheck/build and 72 Vitest tests passed; disposable PostgreSQL 17.11 replay and four pgTAP suites passed 46 assertions; original-index upgrade passed another 7 assertions. CI uses PostgreSQL 16; that version was not run locally. Deno deployment, live provider flow and remote CI remain unverified. No production or shared provider state accessed.
- Task remains uncommitted in the assigned checkout for user review. Exact validation/input identities and task-local service cleanup are recorded outside Git.
