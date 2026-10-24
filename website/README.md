# Soravo website

Local development notes.

## Environment files

- `website/.env` is for Vite client variables only:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - These are public/publishable values. Security depends on RLS, not secrecy.
- `website/supabase/.env.local` is for local Supabase Edge Function development only.
  - It is ignored by git.
  - Start Edge Functions with the CLI's supported env file option:
    - `supabase functions serve --env-file website/supabase/.env.local`
  - Values:
    - `SUPABASE_URL`
    - `SUPABASE_ANON_KEY`
    - `SUPABASE_SERVICE_ROLE_KEY` (server-only)
    - `RAZORPAY_KEY_ID` (test mode only)
    - `RAZORPAY_KEY_SECRET` (server-only, test mode only)
    - `RAZORPAY_WEBHOOK_SECRET` (server-only)
    - `RAZORPAY_CURRENCY=USD`
- `website/supabase/.env.local.example` contains placeholders only and is safe to commit.

## Deployed Edge Function secrets

For deployed functions, enter Edge Function secrets in the NEW Supabase project's dashboard. Do not use the old `soravo` project. Never expose Razorpay or service-role secrets as `VITE_*` values.

## Currency status

Product requirements specify USD. The implementation uses USD amounts `1200` and `5000` minor units. Owner/provider confirmation is still needed before live USD checkout; no live payment or account setting was changed.

## Commands

- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run dev`