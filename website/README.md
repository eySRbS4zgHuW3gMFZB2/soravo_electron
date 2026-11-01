# Soravo website

Local development notes.

## Environment files

- `website/.env.local` is the recommended local Vite config file (Vite also loads `website/.env`):
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - These are public/publishable values. Security depends on RLS, not secrecy.
  - The desktop development app opens the local website at `http://127.0.0.1:5174`; start it with `npm run dev` from `website/` so Vite loads this file.
  - Playwright reads these same values so its local server and request interceptors target the same Supabase project.
- `website/supabase/.env.local` is for local Supabase Edge Function development only.
  - It is ignored by git.
  - From the `website/` directory, start Edge Functions with the CLI's supported env file option:
    - `supabase functions serve --env-file supabase/.env.local`
  - Values:
    - `SUPABASE_URL`
    - `SUPABASE_ANON_KEY`
    - `SUPABASE_SERVICE_ROLE_KEY` (server-only)
    - `RAZORPAY_KEY_ID` (test mode only)
    - `RAZORPAY_KEY_SECRET` (server-only, test mode only)
    - `RAZORPAY_WEBHOOK_SECRET` (server-only)
- `website/supabase/.env.local.example` contains placeholders only and is safe to commit.

The website TypeScript check covers browser sources in `website/src`. The
desktop-auth Edge Function under `website/supabase/functions/` uses Deno and is
outside that Vite TypeScript project; run
`deno check supabase/functions/desktop-auth-handoff/index.ts` from `website/`
when validating Edge Function changes.

## Desktop auth handoff cleanup

Migrations 009 and 010 create the one-time desktop handoff table and remove
already-expired rows during replay. After applying them to a hosted Supabase
project, run `supabase/operations/cleanup_expired_desktop_auth_handoffs.sql`
once in that project's SQL editor to enable the `pg_cron` cleanup job.

## Deployed Edge Function secrets

For deployed functions, enter Edge Function secrets in the NEW Supabase project's dashboard. Do not use the old `soravo` project. Never expose Razorpay or service-role secrets as `VITE_*` values.

## Currency status

Product requirements specify USD. The implementation uses USD amounts `1200` and `5000` minor units. Owner/provider confirmation is still needed before live USD checkout; no live payment or account setting was changed.

## Commands

- `npm run typecheck`
- `npm run test`
- `npm run test:playwright` (starts Vite and builds/serves the site with Wrangler Pages; install Chromium once with `npx playwright install --with-deps chromium`)
- `npm run build`
- `npm run dev`
- `npm run preview:pages` (serve an existing `dist/` build locally on port 8788 with Pages redirects)

Playwright's `chromium` project covers Vite client routes and UI smoke tests.
The `pages-chromium` project repeats navigation tests against the production
build via Wrangler Pages, including direct HTTP requests, reloads, SPA fallback,
and static assets. Run it alone with `npm run test:playwright -- --project=pages-chromium`.

## Routes

Core pages: `/`, `/features`, `/pricing`, `/download`, `/help`.
Auth and recovery: `/login`, `/signup`, `/forgot-password`, `/reset-password`.
Account: `/account` (protected).
Legal placeholder pages: `/privacy`, `/terms`, `/refunds`, `/support`, `/license`.

Legal pages are clearly marked as owner/legal-review placeholders and contain no approved policy text yet.
Entitlements are server-authoritative; browser checkout callbacks only refresh UI state.

## Monthly checkout and subscription reconciliation

Apply migrations through `005_atomic_subscription_checkout_and_events.sql` before deploying the updated Edge Functions.
Monthly checkout reserves the user in the database before contacting Razorpay. Active entitlements or authenticated/active/pending/resumed subscriptions return 409; an existing created subscription returns its provider ID. Another request during creation returns 409.

A provider timeout, ambiguous server error, or failure to save a successful provider response keeps the reservation in `monthly_checkout_reservations`. It deliberately has no automatic expiry. Before releasing a stuck reservation, an operator must reconcile Razorpay subscriptions using the `user_id` and `checkout_request_id` notes: persist any created subscription locally and confirm that no request remains in flight. Release only the matching `user_id`/`request_id` reservation after the outcome is known. Do not retry creation by deleting an unresolved reservation.

Both lifecycle events and payment-triggered active updates use the provider webhook's `created_at` through one conditional database upsert. Older events cannot overwrite newer state; terminal statuses win equal-time ties. The subscription entity's creation time is not a transition timestamp. Undated events cannot replace dated state; an undated terminal event may close an undated checkout and requires provider reconciliation before reactivation. A stale verified capture can extend the recorded paid period without changing subscription status or its event timestamp. Captured-payment provisioning remains authoritative for paid entitlement periods.
