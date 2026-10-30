# Soravo account email and Resend SMTP setup

## Supabase project

Use the intended project `Soravo_fresh` (`vfrhplskegqqdxbykyvx`, us-east-1).
Do not use the historical `soravo` project (`zbzhlhoxblguepplqppw`).

Website client configuration uses only public values:

- `VITE_SUPABASE_URL=https://vfrhplskegqqdxbykyvx.supabase.co`
- `VITE_SUPABASE_ANON_KEY=<publishable/anon key from dashboard>`

Server-only values (`SUPABASE_SERVICE_ROLE_KEY`, Razorpay secrets) belong in
`website/supabase/.env.local` or Supabase Edge Function secrets, never in `VITE_*`.

## Supabase Auth Site URL

Set the project's primary **Site URL** to the canonical production origin:

- `https://soravo.xyz`

The Site URL is the fallback used only when a requested `redirect_to` is not
in the allowlist below. Do not use `http://localhost:3000` as the Site URL for
the shared preview/production project.

## Supabase Auth redirect allowlist

Add these *exact* redirect URLs in Supabase Auth settings for the `Soravo_fresh`
project. Do not use wildcards.

- Local: `http://localhost:5173/account`, `http://localhost:5173/reset-password`, `http://localhost:5173/login`
- Preview (stable host): `https://soravo-web-preview.pages.dev/account`,
  `https://soravo-web-preview.pages.dev/reset-password`,
  `https://soravo-web-preview.pages.dev/login`
- Production: `https://soravo.xyz/account`, `https://soravo.xyz/reset-password`, `https://soravo.xyz/login`

Do not allow wildcard or cross-origin redirect URLs.

## Resend and DNS status

Current Cloudflare DNS for `soravo.xyz` contains Zoho business email records:

- MX: `mx.zoho.in`, `mx2.zoho.in`, `mx3.zoho.in`
- TXT SPF: `v=spf1 include:zoho.in include:spf.privateemail.com ~all`
- TXT DKIM: `zmail._domainkey.soravo.xyz`

These must be preserved. Do not overwrite, delete, or create a conflicting SPF record.

Preferred sender domain: `mail.soravo.xyz`, sender `no-reply@mail.soravo.xyz`.

No Resend DNS records were added because the exact records required by the
current Resend dashboard were not available to this agent. Owner action:

1. Open the Resend dashboard and add/verify the `mail.soravo.xyz` domain.
2. Copy the exact DNS records Resend requires (name, type, value).
3. Add only those records in Cloudflare for the `mail.soravo.xyz` subdomain.
4. Verify the domain in Resend.
5. Create a least-privilege Resend API key for SMTP.
6. In Supabase Auth custom SMTP settings, use the Resend-documented values:
   - host `smtp.resend.com`
   - username `resend`
   - password = Resend API key
   - recommended TLS/port from current Resend/Supabase docs
   - sender `no-reply@mail.soravo.xyz`
7. Disable link tracking for authentication emails if it could alter URLs.

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