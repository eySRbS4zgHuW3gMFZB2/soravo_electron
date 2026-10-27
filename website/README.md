# Soravo website

Local development notes.

## Environment files

- `website/.env` is for Vite client variables only:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - These are public/publishable values. Security depends on RLS, not secrecy.
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

## Deployed Edge Function secrets

For deployed functions, enter Edge Function secrets in the NEW Supabase project's dashboard. Do not use the old `soravo` project. Never expose Razorpay or service-role secrets as `VITE_*` values.

## Currency status

Product requirements specify USD. The implementation uses USD amounts `1200` and `5000` minor units. Owner/provider confirmation is still needed before live USD checkout; no live payment or account setting was changed.

## Commands

- `npm run typecheck`
- `npm run test`
- `npm run test:playwright` (run `npm run dev` first or let Playwright start it)
- `npm run build`
- `npm run dev`

## Routes

Core pages: `/`, `/features`, `/pricing`, `/download`, `/help`.
Auth and recovery: `/login`, `/signup`, `/forgot-password`, `/reset-password`.
Account: `/account` (protected).
Legal placeholder pages: `/privacy`, `/terms`, `/refunds`, `/support`, `/license`.

Legal pages are clearly marked as owner/legal-review placeholders and contain no approved policy text yet.
Entitlements are server-authoritative; browser checkout callbacks only refresh UI state.

## Monthly checkout and subscription reconciliation

Apply migrations through `004_atomic_subscription_checkout_and_events.sql` before deploying the updated Edge Functions.
Monthly checkout reserves the user in the database before contacting Razorpay. Active entitlements or authenticated/active subscriptions return 409; an existing created subscription returns its provider ID. Another request during creation returns 409.

A provider timeout, ambiguous server error, or failure to save a successful provider response keeps the reservation in `monthly_checkout_reservations`. It deliberately has no automatic expiry. Before releasing a stuck reservation, an operator must reconcile Razorpay subscriptions using the `user_id` and `checkout_request_id` notes: persist any created subscription locally and confirm that no request remains in flight. Release only the matching `user_id`/`request_id` reservation after the outcome is known. Do not retry creation by deleting an unresolved reservation.

Both lifecycle events and payment-triggered active updates use the provider webhook's `created_at` through one conditional database upsert. Older events cannot overwrite newer state; terminal statuses win equal-time ties. The subscription entity's creation time is not a transition timestamp. Undated events cannot replace dated state; an undated terminal event may close an undated checkout and requires provider reconciliation before reactivation. Captured-payment provisioning remains authoritative for paid entitlement periods.
