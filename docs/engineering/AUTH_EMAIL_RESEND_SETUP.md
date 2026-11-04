# Soravo account email and Resend SMTP setup

## Supabase project

Use the intended project `Soravo_fresh` (`vfrhplskegqqdxbykyvx`, us-east-1).
Do not use the historical `soravo` project (`zbzhlhoxblguepplqppw`).

Website client configuration uses only public values:

- `VITE_SUPABASE_URL=https://vfrhplskegqqdxbykyvx.supabase.co`
- `VITE_SUPABASE_ANON_KEY=<publishable/anon key from dashboard>`

Server-only values (`SUPABASE_SERVICE_ROLE_KEY`, Razorpay secrets) belong in
`website/supabase/.env.local` or Supabase Edge Function secrets, never in `VITE_*`.

## Supabase Auth redirect allowlist

Add these redirect URLs in Supabase Auth settings for the `Soravo_fresh` project:

- Local: `http://localhost:5173/account`, `http://localhost:5173/reset-password`, `http://localhost:5173/login`
- Preview: `https://<preview-host>/account`, `https://<preview-host>/reset-password`, `https://<preview-host>/login`
- Production: `https://soravo.xyz/account`, `https://soravo.xyz/reset-password`, `https://soravo.xyz/login`

Do not allow wildcard or cross-origin redirect URLs.

## Resend and DNS status

Current Cloudflare DNS for `soravo.xyz` contains Zoho business email records:

- MX: `mx.zoho.in`, `mx2.zoho.in`, `mx3.zoho.in`
- TXT SPF: `v=spf1 include:zoho.in include:spf.privateemail.com ~all`
- TXT DKIM: `zmail._domainkey.soravo.xyz`

These must be preserved. Do not overwrite, delete, or create a conflicting SPF record.

Authoritative Resend infrastructure documentation:
`docs/engineering/RESEND_INFRASTRUCTURE_AND_OPERATIONS.md`.

The approved transactional sender is now:
- From: `Soravo <account@notifications.soravo.xyz>`
- Reply-to: `support@soravo.xyz`

Do not use obsolete `mail.soravo.xyz` or `no-reply@mail.soravo.xyz` instructions.

Supabase Auth SMTP uses Resend SMTP, but the actual saved state must be verified
before it is documented as configured. Do not claim it was saved or tested
without dashboard evidence.

Disable link tracking for authentication emails if it could alter URLs.

## Free-tier limits

- Supabase Free projects can pause after inactivity; custom SMTP is required for
  public auth email because the built-in email service is limited.
- Resend Free has monthly and daily sending limits; monitor bounces, complaints,
  and rate-limit responses.
- Do not disable email confirmation to work around missing SMTP.

## Monitoring

Monitor Supabase Auth logs, Resend delivery/bounce/complaint dashboards, and
application error states for rate limits, SMTP failures, and reset-link issues.
Redact one-time links and tokens from logs.

## Application-level transactional email (2026-11-03)

- Shared helper: `website/supabase/functions/_shared/email.ts`
- Resend webhook receiver: `website/supabase/functions/resend-webhook/`
- Secret names (values never committed): `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`
- Sender: `Soravo <account@notifications.soravo.xyz>`
- Reply-to: `support@soravo.xyz`
- Auth SMTP remains separate and must keep its own sender/domain configuration.
- `email_outbox` table is server-only and stores idempotency keys/retry state.