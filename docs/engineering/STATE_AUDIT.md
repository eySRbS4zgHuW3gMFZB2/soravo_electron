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

## Bounded subscription review-fix audit — 2026-10-27

- CONFIRMED: initially clean isolated assigned task checkout on `coderabbit/api-subscription-hardening/8b15d30d`, sole registered worktree; base `74ec17eae3f6dbe0840b2766cdcfb5d08ac4e00a`. Existing entitlement guards and provider-ID reuse were present, but concurrent external creation and unconditional captured-event subscription upserts remained possible.
- CONFIRMED: minimal alias removal plus migration 004 move checkout checks/reservation and provider event ordering into atomic database operations. Tests cover failure retention, safe release, provider-ID reuse, cancellation before local persistence, stale/equal/undated events and role permissions.
- CONFIRMED: Ubuntu 26.04.1, Node 24.21.0/npm 11.19.0; website frozen dependency installation succeeded. Disposable PostgreSQL 18.6 with synthetic Auth bootstrap and pgTAP is used locally; CI remains PostgreSQL 16. No external account, credentials, live service or production state changed.
- LIMITATIONS: Deno deployment, live Razorpay traffic and remote CI for this patch were not exercised. Ambiguous provider creation requires operator reconciliation before a reservation is released. Detailed local validation/review outcomes are kept in the external validation record and session handoff.
