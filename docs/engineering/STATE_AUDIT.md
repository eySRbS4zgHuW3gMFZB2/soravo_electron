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

## Supabase Resend auth audit - 2026-10-26

- CONFIRMED at `e1c7337b6574b987296f28e6ffea386d2b755c09`: worktree `feature-supabase-resend-auth-e2e` on branch `feature/supabase-resend-auth-e2e`, initially clean.
- CONFIRMED Supabase projects: historical `soravo` (`zbzhlhoxblguepplqppw`, ap-northeast-2) and intended `Soravo_fresh` (`vfrhplskegqqdxbykyvx`, us-east-1). This workstream targets `Soravo_fresh`; no remote mutation performed.
- CONFIRMED Cloudflare zone `soravo.xyz` (`892821fa91d4050a787fee4e505918c5`) has Zoho MX/SPF/DKIM records plus `soravo.pages.dev` CNAMEs. No DNS records were changed.
- BLOCKED: Resend domain verification and SMTP credentials require dashboard access; exact Resend DNS records were not available, so no DNS writes were made. Owner action required.
