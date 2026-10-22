# Technical Design Document (TDD)

## 1. Architecture

### Desktop
- Tauri v2 shell; Rust backend; React 18 + TypeScript + Vite renderer.
- Local SQLite history and `tauri-plugin-store` settings remain local.
- Current CrispASR integration is preserved. No engine migration in this project.
- The renderer is untrusted for authorization. Any license decision that matters must be verified in Rust and/or by the server.
- Commercial integration must not route audio/transcripts through Supabase, Cloudflare, Razorpay, Resend or analytics.

### Engine packaging (blocking)
The installed application must be able to find and launch the transcription engine **without any developer-only fetch step and without a source tree present**. As audited on 2026-10-22, this does not currently hold:

- `bundle.resources` and `bundle.externalBin` are both empty, so nothing from the repository is copied into the installed application.
- `third-party/bin/` is git-ignored and contains no tracked files. It exists only on developer machines after `npm run fetch:asr`.
- The engine is committed at `third-party/crispasr/extracted/crispasr-windows-x86_64-cpu/` (`crispasr.exe`, `openblas.dll`, `crispasr-quantize.exe`, `LICENSE`, `THIRD_PARTY_NOTICES.txt`).
- The runtime lookup `find_crispasr_binary` in `src-tauri/src/lib.rs` searches `<root>/third-party/bin/`, then the children of `<root>/third-party/crispasr/extracted/`, over the roots `current_dir`, `project_root` and the Tauri `resource_dir`. On an installed machine the first two do not exist and the third holds no engine.

Design requirements:
- The bundled layout is a decision to be recorded in **ADR-0010** before packaging work begins: a Tauri `bundle.resources` mapping, an `externalBin` sidecar, or a deliberate rename of the tracked staging directory. Do not begin packaging against an undecided layout.
- Whatever is bundled must be **tracked in git**, so that a clean clone and a clean CI runner produce the same artifact.
- Confirm redistribution rights and required notices for every bundled binary and DLL before bundling (`22_REVERSE_ENGINEERING_AND_PROVENANCE.md`). Do not bundle files blindly.
- Models are **not** bundled. They are acquired at runtime through the existing model download flow, with licence and provenance recorded per model (`MODELS.md` is a starting point, not proof).
- **Release gate:** no release until a clean-machine install, with no developer tools and no source tree, proves the app locates and launches the bundled engine and can dictate.

### Web
- `website/` under the same Git repository.
- Separate `package.json` and lockfile. Do not convert the existing desktop root to a workspace without an ADR.
- Cloudflare Pages deployment; path-scoped CI. Preview deployments must use non-production credentials and data.
- Shared brand tokens may be copied or shared only through a deliberate, minimal dependency; do not couple web build output to Tauri `frontendDist`.

### Identity/data
- Supabase Auth for identity.
- Supabase Postgres for profiles, devices, entitlements/subscriptions, payment ledger, audit events and minimal analytics metadata only where needed.
- Resend SMTP for Auth email. Verify DNS/domain, sender and deliverability.
- All tables exposed through client APIs must have RLS enabled and policies tested. Privileged operations use server-side functions with secrets kept server-side.
- Do not assume the old repo's Supabase project, schema or migrations are appropriate. Start with a new schema design and migration history for this product.

### Server-side API
Use a small server-side API boundary for entitlement operations and Razorpay webhook processing. The implementation plan must choose one primary backend and record the decision in the ADR index before implementation depends on it. Avoid duplicating privileged business logic across two providers.

**Backend placement is currently PROPOSED, not decided** (ADR-0003). The candidates are Cloudflare Pages Functions/Workers and Supabase Edge Functions. Supabase Edge Functions are the candidate favoured by the current read of the requirements, because they sit adjacent to the auth and data they serve, but that is a preference to be confirmed, not a settled architecture. Task P2-08 exists to choose one and write the rationale into ADR-0003. Do not begin implementation that depends on this choice before that ADR is ACCEPTED. Do not put Supabase service-role keys in the website bundle or desktop binary under either candidate.

### Website rebuild strategy
The replacement website is built **fresh** in this repository, following this pack. The historical `soravo` repository is a **behavioral and content reference only** for approved website pages, pricing presentation and dashboard behaviors. Its implementation, Supabase schema, migrations, Edge Functions, workflows and Handy-derived desktop code are **not** ported (ADR-0008).

Consequences to design against:
- The replacement is not a refactor of the historical site. Shared identifiers, table names and API shapes are free to differ, and a difference is not a regression.
- Do not assume the historical Supabase project, its schema, its migrations or its live data are appropriate. A new schema and migration history are designed for this product. The historical project is in fact observed as currently paused (`INACTIVE`), which reinforces that it must not be treated as a live dependency.
- The existing production site at `soravo.xyz` stays live and untouched until the replacement passes its launch checklist. Cutover is a separate, approved, reversible step; see `27_PRODUCTION_CUTOVER_AND_ROLLBACK.md`.

### Payments
- Razorpay Checkout or hosted subscription flow.
- Verify webhook signature according to current Razorpay documentation and the exact webhook signing scheme.
- Idempotency ledger keyed by provider event ID or stable event identity.
- Grant/renew/revoke entitlements only after verified server-side events.
- Store provider identifiers and normalized Soravo state separately.
- Never trust client-supplied amount, plan, user ID or “payment success”.

### Downloads/releases
- Public release assets must be reachable without authentication.
- Preferred free option: separate public GitHub repository containing only signed/hashed release artifacts, versioned release notes and checksums; source repo can be private.
- Generate SHA-256 checksums in CI after final artifacts are produced. Verify them from a clean download.
- Do not claim a checksum proves publisher identity; an attacker who can replace both file and checksum can defeat that check.
- Consider optional minisign signatures with an offline-held private key; public key can ship with website/docs.
- Tauri updater signing is separate from OS code signing. Do not conflate these.
- Store release metadata in a small JSON manifest only after validating asset names, hashes, versions and platform URLs.

## 2. Proposed data model (new schema, not copied from old repo)

Names are conceptual and can be revised in an ADR before migration implementation.

- `profiles`: `user_id` PK/FK to auth user, display name, created_at, updated_at.
- `devices`: id, user_id, random device_id, label, platform, app_version, first_seen_at, last_seen_at, revoked_at.
- `entitlements`: id, user_id, plan_code, status, issued_at, last_verified_at, subscription_period_end, lifetime flag, metadata version.
- `payments`: id, user_id, provider, provider_payment_id, provider_order_id/subscription_id, amount_minor, currency, status, created_at, verified_at, refund/chargeback state.
- `webhook_events`: provider, provider_event_id/idempotency key, received_at, signature_valid, processing_status, safe error code, processed_at.
- `admin_audit_events`: actor user ID, action, target type/ID, timestamp, reason, minimal safe metadata.
- Optional `support_cases`: only if a real support workflow needs it; avoid collecting transcripts/audio.

Avoid storing secrets, card data, raw payment credentials, transcript text, audio, or unnecessary IP/user-agent histories in these tables.

## 3. Security boundary

- Public anon/publishable keys may be embedded only when intended by vendor design and RLS is correct.
- Service-role, Razorpay key secret/webhook secret, Resend SMTP credentials and Cloudflare API tokens are server secrets.
- Server verifies admin role on every privileged operation. Hiding admin navigation is not authorization.
- Rate-limit auth, device registration, license checks and webhook failure paths.
- Use short-lived, single-use desktop callback codes; no bearer token in deep links.
- Prefer OS credential storage for refresh tokens.
- Entitlement cache must be integrity-protected as far as feasible and versioned.
- Log outcomes and correlation IDs, never tokens, email magic links, secrets, audio or transcripts.

## 4. CORS, CSP, and Tauri

The checked `tauri.conf.json` has `app.security.csp: null`. Before enabling commercial sign-in or web content, define a restrictive Content Security Policy suitable for Tauri, with explicit sources for the app and required API endpoints. Do not add broad wildcards just to silence console errors.

Deep links must be allowlisted and validated. Treat all callback parameters as untrusted. Verify state/nonce and one-time code server-side.

## 5. Failure behavior

- If licensing service is down, use the cached monthly entitlement for up to 14 days; lifetime remains usable indefinitely after activation.
- If Resend is down, show a clear retry/recovery path and avoid claiming an email was delivered.
- If Razorpay webhook processing is delayed, show payment as pending until reconciled.
- If Cloudflare Pages is down, installed app local dictation should still function subject to cached entitlement policy.
- If Supabase free project pauses, monitor and restore promptly; no free-tier architecture guarantees uptime.
