# Architecture Decision Records (ADR) Index

Write one ADR per durable architecture choice. Use status `PROPOSED`, `ACCEPTED`, `SUPERSEDED`, or `REJECTED`. Do not edit an accepted ADR to rewrite history; create a superseding ADR.

## ADR-0001 — Preserve Tauri/CrispASR desktop

**Status:** ACCEPTED by owner  
Preserve the current Tauri v2 application and CrispASR integration. Commercial infrastructure is added around it; no engine migration in this workstream.

## ADR-0002 — Website in same repository, independent app

**Status:** ACCEPTED  
Create `website/` with its own package manifest/lockfile. Keep desktop build configuration and `frontendDist` isolated.

## ADR-0003 — Commercial services

**Status:** ACCEPTED (backend placement decided 2026-10-23, task P2-08)

**Accepted services:**
- Cloudflare Pages for website hosting (static assets + SPA routing) — NEW project, not the existing soravo.xyz site
- Supabase Auth/Postgres for identity and data — NEW project, not the existing 'soravo' Supabase project
- Resend for custom SMTP (Auth email)
- Razorpay for payments
- Cloudflare Web Analytics for site traffic

**Project isolation (new vs. past):**

The existing live website at `soravo.xyz` and the existing Supabase project named `soravo` belong to the **past project** (the historical `soravo` repository). They are **not** to be reused, migrated, or modified. The new Soravo app requires:

1. **New Supabase project** — created in a separate Supabase organization or under a new project name (e.g., `soravo-fresh` or `soravo-app`). This project gets its own:
   - Project reference ID and API URL
   - Anon/publishable key and service-role key
   - Database schema and migration history (starting from `website/supabase/migrations/`)
   - Auth configuration (redirect URLs, SMTP via Resend)
   - Edge Functions deployment
   - No data, credentials, or settings are copied from the old `soravo` project

2. **New Cloudflare Pages project** — created for the new website under `website/`. This project:
   - Uses a separate Cloudflare Pages project name (e.g., `soravo-web` or `soravo-app`)
   - Deploys from the `website/` directory in this repository
   - Uses non-production credentials for preview deployments
   - Does NOT modify the existing `soravo.xyz` DNS, email, or Pages configuration
   - The production domain `soravo.xyz` stays untouched until an explicit, separately approved cutover (see `27_PRODUCTION_CUTOVER_AND_ROLLBACK.md`)

3. **Environment separation:**
   - **Development:** Local `.env` files with placeholder values; Supabase local dev (via Supabase CLI) or a dedicated dev project
   - **Staging/Preview:** Cloudflare Pages preview deployments with non-production Supabase credentials
   - **Production:** Separate production Supabase project and Cloudflare Pages project, configured only at cutover time
   - No environment shares credentials with the past project

4. **Safe setup steps (documentation only — do NOT execute without approval):**
   a. Create a new Supabase project (organization: new or existing, project name: `soravo-fresh`)
   b. Record the new project's reference ID, API URL, and keys in a secure secret store (not in git)
   c. Create a new Cloudflare Pages project linked to this repository's `website/` directory
   d. Configure environment variables in Cloudflare Pages (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) using the NEW project's values
   e. Apply the initial migration (`website/supabase/migrations/001_initial_schema.sql`) to the new Supabase project
   f. Configure Supabase Auth redirect URLs for the new Cloudflare Pages domain
   g. Configure Resend SMTP in the new Supabase project
   h. Deploy Edge Functions to the new Supabase project
   i. Verify all functionality on the preview deployment before any production cutover

5. **Isolation guarantees:**
   - No data migration from the old `soravo` Supabase project
   - No credential reuse (new anon key, new service-role key, new JWT secret)
   - No DNS changes to `soravo.xyz` or its email configuration
   - No modification to the old Supabase project's schema, RLS, or auth settings
   - The old Supabase project remains paused/inactive and is not a dependency

**Backend function placement — DECIDED: Supabase Edge Functions**

Rationale:
1. **Data proximity:** Edge Functions run in the same Supabase project as Auth and Postgres. Razorpay webhook processing, entitlement provisioning, and device registration all need direct database access. Co-locating the API with the data eliminates cross-provider network hops and reduces latency for auth-gated operations.
2. **Auth integration:** Supabase Edge Functions have native access to the Supabase Auth context. Verifying JWTs, checking user identity, and enforcing authorization happen without additional HTTP calls to an external identity provider.
3. **Secret management:** Supabase Edge Functions use project-level secrets (set via Supabase dashboard or CLI). Service-role keys, Razorpay secrets, and webhook secrets stay within the Supabase trust boundary. No cross-provider secret sharing is needed.
4. **RLS enforcement:** Since Edge Functions use the service-role key server-side, they can bypass RLS for privileged operations while the website uses the anon key with RLS enforced. This creates a clean separation between client (RLS-protected) and server (service-role) access.
5. **Single provider for privileged logic:** All server-side business logic (webhook processing, entitlement provisioning, device limits, admin operations) lives in one provider. No duplication across Cloudflare and Supabase.

**Trade-offs accepted:**
- Supabase Edge Functions run on Deno runtime, not Node.js. Some npm packages may not be compatible. Mitigation: use Deno-compatible imports and test thoroughly.
- Supabase free tier has function invocation limits. Mitigation: monitor usage; upgrade tier if needed.
- Cloudflare Pages still hosts the static website and handles SPA routing. Edge Functions are invoked via Supabase's own URL (`https://<project>.supabase.co/functions/v1/`), not via Cloudflare.

**Cloudflare Pages role:** Hosts the static website (React SPA) only. No server-side logic runs on Cloudflare. Pages Functions are NOT used for privileged operations.

**Secrets handling:**
- Service-role key: Supabase Edge Function secret only. Never in website bundle or desktop binary.
- Razorpay key secret + webhook secret: Edge Function secrets only.
- Resend SMTP credentials: Supabase Auth configuration (managed by Supabase).
- Cloudflare API tokens: CI/deployment only, never in client code.
- Public anon/publishable keys: safe to embed in website bundle (RLS enforced).

**Webhook security:**
- Razorpay webhooks are received by a Supabase Edge Function
- Signature verified via HMAC-SHA256 using the webhook secret (server-side only)
- **Atomic deduplication:** A unique constraint on `(provider, provider_event_id)` in the `webhook_events` table ensures only one row can exist per event. Processing uses an atomic claim pattern: `INSERT ... ON CONFLICT (provider, provider_event_id) DO NOTHING` followed by checking `affected rows`. If the insert succeeds (new row), the Edge Function proceeds with processing. If the insert is a no-op (duplicate), the function returns 200 OK immediately without reprocessing.
- Idempotency checked against `webhook_events` table before processing
- Duplicate events return 200 OK without reprocessing
- Concurrent duplicate deliveries cannot both proceed: the unique constraint ensures only one claim succeeds

**Webhook processing states and retry behavior:**
- `processing_status` values: `received` (initial insert), `processing` (claim acquired, work in progress), `processed` (success, side effects applied), `failed` (processing error, retryable), `duplicate` (no-op claim, already processed)
- **Claim lifecycle:** `received` → `processing` → `processed` (success) or `failed` (error)
- **Failed claims are retryable:** A webhook delivery that fails during processing leaves the row in `failed` state. A subsequent retry (same `provider_event_id`) finds the existing row, checks that `processing_status = 'failed'`, and re-attempts processing. The unique constraint prevents duplicate rows.
- **Completed events are not reprocessed:** A retry for an event with `processing_status = 'processed'` returns 200 OK immediately without reapplying side effects.
- **Reconciliation:** A scheduled reconciliation job (or manual admin action) can retry all `failed` webhook events by re-invoking the processing logic. Failed events are retried with exponential backoff up to a maximum number of attempts.
- **Maximum retry attempts:** After N failed attempts (configurable, default 5), the event transitions to `support_review` status and requires manual intervention.
- **Side-effect idempotency:** Payment and entitlement creation use `provider_payment_id` / `provider_event_id` as idempotency keys, so even if processing is retried, duplicate side effects are prevented at the database level.

**Project isolation (new vs. past):**
- The existing Supabase project named `soravo` and the live site at `soravo.xyz` belong to the **past project** and must remain untouched.
- A **completely new Supabase project** must be created for the new Soravo app. No data, credentials, schema, or settings are reused or migrated.
- A **new Cloudflare Pages project** must be created for the new website. The existing `soravo.xyz` DNS, email, and Pages configuration remain unchanged.
- Full isolation requirements and safe setup steps are documented in `31_NEW_PROJECT_ISOLATION_AND_SETUP.md`.
- No infrastructure is created or production settings changed by this documentation task.

**Authorization boundaries:**
- Website (client): uses anon key + RLS. Users can only read/write their own data.
- Edge Functions (server): use service-role key. Can perform privileged operations (webhook processing, entitlement provisioning, device limit checks, admin actions).
- Desktop app: uses anon key + RLS for read operations. Device registration and license verification go through Edge Functions.
- User-invoked Edge Functions validate the caller's JWT and derive or verify every `user_id` and `device_id` against the authenticated caller before using service-role access.
- Admin operations: Edge Functions verify admin role (via `profiles` or a dedicated `admin_roles` table) before executing. Hiding admin UI is not authorization.

## ADR-0004 — Entitlement policy

**Status:** ACCEPTED  
Monthly $12, recurring, max 3 active devices, 14-day offline grace. Lifetime $50, unlimited devices, indefinite offline after activation. Enterprise deferred.

## ADR-0005 — Binary distribution

**Status:** PROPOSED — not final, and not to be implemented as decided  
Preferred candidate: a separate public `soravo-releases` repository containing artifacts only, so that public download links work without customer GitHub authentication while the source repository can be private. The owner asked for alternatives to any public repository, so the host is not settled. Before this ADR can become ACCEPTED it needs: an anonymous-download proof of download from a logged-out browser on a second network; confirmation that the chosen host does not require a payment card; confirmation of current file-size and quota limits from official docs; and a decision on checksum publication plus an optional minisign signature. See `14_FREE_BINARY_HOSTING_OPTIONS.md` for the option set and the decision rule. Do not start Phase 8 distribution work against this ADR while it is PROPOSED.

## ADR-0006 — Repository naming

**Status:** ACCEPTED intention, not yet executed  
Rename old repo `soravo` → `soravo_deprecated`; rename active repo `soravo_electron` → `soravo`; rename local folder. Must be done sequentially with backup and URL updates.

**Ordering constraint (added 2026-10-22, see ADR-0008):** the rename is **not** the first Phase 0 action. Baseline CI must be green in `soravo_electron` before any repository is renamed. The release-packaging check is the single documented exception: it must exist, run, and report, with its red result recorded as the known missing-engine baseline. Any other packaging-check failure blocks the rename, so that a renamed repository inherits working, verifiable automation.

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

**Status:** ACCEPTED (2026-10-22, task P0-01)  
The engine is bundled into the installed application via Tauri bundle.resources (map form) from the tracked path third-party/crispasr/extracted/crispasr-windows-x86_64-cpu/ to resource_dir()/crispasr/. VC++ runtime is bundled via bundle.windows.bundleVCRuntime: true. See P0-01 findings for full rationale. The currently committed location is `third-party/crispasr/extracted/crispasr-windows-x86_64-cpu/`; the `third-party/bin/` path that the README names is git-ignored and contains no tracked files. **Decision (2026-10-22, task P0-01):** Use Tauri bundle.resources in map form: source third-party/crispasr/extracted/crispasr-windows-x86_64-cpu/ maps to target crispasr/ in the bundle. VC++ runtime bundled via bundle.windows.bundleVCRuntime: true. Rationale: preserves directory structure (exe + DLL together for Windows loader), works identically in dev and production, no binary renaming needed. Alternatives (externalBin sidecar, directory rename) rejected for added complexity. See P0-01 findings for full rationale.

This ADR additionally records the release gate: **no release until a clean-machine install, with no developer tools and no source tree, proves the app locates and launches the bundled engine.** Redistribution rights for every bundled binary and DLL must be confirmed before bundling.

**Platform scope within this ADR.** The repository tracks a Windows engine at
`third-party/crispasr/extracted/crispasr-windows-x86_64-cpu/` and a Linux
engine at `third-party/crispasr/extracted/crispasr-linux-x86_64-cpu/`.
`find_crispasr_binary` resolves `crispasr.exe` on Windows but `crispasr` on
Linux, and checks `resource_dir/crispasr/` (Windows) and
`resource_dir/crispasr-linux/` (Linux) first on installed machines.

**Linux engine (task P1-05).** Obtained from CrispASR v0.8.44:
`crispasr-linux-x86_64.tar.gz` (~41 MB, AVX2 CPU baseline).
- SHA-256: `9754A21D00463FABBD61EFA27D91E2103357B95FF52A8DE8208D33C6569285CE`
- License: MIT (`LICENSE` in bundle, `THIRD_PARTY_NOTICES.txt` documents
  ggml MIT, llamafile/sgemm MIT, OpenBLAS BSD-3, libgomp GPL-3.0+GCC-exception)
- Tracked at: `third-party/crispasr/extracted/crispasr-linux-x86_64-cpu/`
- Bundled files: `crispasr`, `crispasr-quantize`, `libopenblas.so.0`,
  `libgomp.so.1`, `libgfortran.so.5`, `libquadmath.so.0`, `libc2pa_c.so`,
  `LICENSE`, `THIRD_PARTY_NOTICES.txt`

**Release gate:** No Linux release until a clean-machine Linux install (no
developer tools, no source tree) proves the app locates and launches the
bundled engine and can dictate. This gate is NOT yet verified — task P1-08
remains open.

## ADR template

- Context
- Decision
- Alternatives considered
- Consequences/trade-offs
- Security/privacy implications
- Cost/free-tier assumptions
- Rollback/migration
- Evidence links/date
