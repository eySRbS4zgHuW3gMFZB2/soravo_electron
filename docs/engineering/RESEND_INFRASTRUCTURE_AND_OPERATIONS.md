# Resend Infrastructure and Operations

## Status

Implementation is in the repository (PR #44 continuation). Hosted Supabase migration application, Edge Function deployment, Resend webhook registration, SMTP configuration save, and production scheduling require owner/dashboard steps documented below.

## Domain and DNS architecture

Registrar: Namecheap.

Authoritative DNS: Cloudflare.

Production domain: `soravo.xyz`.

Cloudflare nameservers:
- `chance.ns.cloudflare.com`
- `love.ns.cloudflare.com`

DNS changes must be made in Cloudflare, not Namecheap AdvancedDNS, while these nameservers remain active.

## Cloudflare website context (reference only; do not modify here)

- Cloudflare account ID: `88e94f637378412bf8f6b540a45e8dcb`
- Zone ID: `892821fa91d4050a787fee4e505918c5`
- Production website is served by `soravo-web-preview`.
- `www.soravo.xyz` redirects to the canonical non-www domain.
- Old `soravo` Pages project remains preserved as rollback.

## Existing business email: Zoho Mail (must be preserved)

Current known records:
- MX `soravo.xyz` -> `mx.zoho.in`, priority 10
- MX `soravo.xyz` -> `mx2.zoho.in`, priority 20
- MX `soravo.xyz` -> `mx3.zoho.in`, priority 50
- TXT `soravo.xyz` -> `v=spf1 include:zoho.in include:spf.privateemail.com ~all`
- TXT `soravo.xyz` -> Zoho verification record
- TXT `zmail._domainkey.soravo.xyz` -> Zoho DKIM

Rules:
- Never replace Zoho MX records with Resend records.
- Never overwrite the root SPF record with a second conflicting SPF record.
- Never remove Zoho DKIM.
- Never change nameservers to Namecheap BasicDNS without owner approval.
- The Resend transactional subdomain uses its own records and does not replace root-domain mail configuration.

## Root-domain Resend domain (previously verified)

Domain: `soravo.xyz`.
Resend domain ID: `895ff26a-dc7a-4d50-8e25-cabd596df4e3`.

Previously added records:
- TXT `resend._domainkey.soravo.xyz` -> exact existing Resend DKIM value.
- CNAME `rsend.soravo.xyz` -> `rsend.forge.rmta.net`
- CNAME `send.soravo.xyz` -> `send.forge.rmta.net`

This root-domain configuration is separate from the dedicated transactional subdomain and remains verified. Do not invent the DKIM public key; read and verify it directly in Cloudflare/Resend.

## Transactional subdomain

Approved sender domain: `notifications.soravo.xyz`.

Resend domain ID: `ab62cacb-545e-421a-8154-466fcb210f1f`.
Region: `us-east-1`.
Latest owner-confirmed state:
- Domain verified.
- Sending enabled.
- Receiving disabled.
- Open tracking disabled.
- Click tracking disabled.
- TLS enforced.
- Custom return path: `send`.

Records (DNS-only, not proxied):
- TXT `resend._domainkey.notifications.soravo.xyz` -> exact DKIM value from Cloudflare/Resend.
- MX `send.notifications.soravo.xyz` -> `feedback-smtp.us-east-1.amazonses.com`, priority 10.
- TXT `send.notifications.soravo.xyz` -> `v=spf1 include:amazonses.com ~all`
- CNAME `rsend.notifications.soravo.xyz` -> `send.forge.rmta.net`

Do not modify these records as part of application work.

## Sender identity

Display name: `Soravo`.
From: `account@notifications.soravo.xyz`.
Reply-to: `admin@soravo.xyz`.

The sender address does not require a separate Zoho mailbox to send through Resend. `admin@soravo.xyz` is the reply destination.

## Supabase Auth SMTP

Project: `Soravo_fresh` (`vfrhplskegqqdxbykyvx`).
Setting location: `https://supabase.com/dashboard/project/vfrhplskegqqdxbykyvx/auth/smtp`.
SMTP intended values:
- Sender name: `Soravo`
- Sender email: `account@notifications.soravo.xyz`
- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: restricted Resend API key

The actual saved state must be verified before stating SMTP is configured. Do not claim SMTP was saved or tested without dashboard evidence.

## Resend API keys and secrets

Required names:
- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET`

They belong in Supabase Edge Function secrets. Send permission should be restricted to `notifications.soravo.xyz` where supported.

Security:
- Never place real values in Git or `.env.example`.
- Never print, log or commit keys.
- A previously exposed Resend API key should be treated as owner-verification-required for rotation status. Do not reproduce the exposed value.

Local development uses ignored environment files or secure secret injection only.

## Resend webhook

Endpoint: `https://vfrhplskegqqdxbykyvx.supabase.co/functions/v1/resend-webhook`.
Approved events:
- `email.sent`
- `email.delivered`
- `email.delivery_delayed`
- `email.bounced`
- `email.complained`
- `email.failed`
- `email.suppressed`

Requirements:
- Receiver deployment must exist before webhook registration.
- Register the webhook only after owner approval and endpoint deployment.
- Store the returned signing secret as `RESEND_WEBHOOK_SECRET`.
- Receiver verifies the exact raw request body.
- Delivery events update `email_outbox.delivery_status` by `provider_message_id`.
- An unmatched message ID returns a retryable error for five minutes from first receipt; a later delivery is acknowledged after that window. Auth SMTP messages without outbox rows follow the same rule. A retry from Resend is required for processing after the window.
- Delivery events never mutate payment, subscription or entitlement state.

Current status: implemented in code; deployed/registered status remains implementation-complete-pending-deployment.

## Separation of email systems

Supabase Auth SMTP:
- Email confirmation.
- Password reset.
- Magic links.
- Other Auth system emails.

Application-level Resend API:
- Welcome.
- Payment receipt.
- Subscription activation.
- Renewal notification.
- Payment failure notification.
- Expiry notification.
- Refund notification.

Both use the approved sender where configured, but their control paths and secrets are separate.

## Architecture implemented in this work

Verified business event -> database transaction -> `email_outbox` insertion -> worker claim -> Resend HTTPS API -> provider message ID -> webhook delivery status update.

Authoritative systems:
- Payments and entitlements remain in Razorpay webhook/RPC paths.
- Email only notifies; failure never reverses payment or entitlement state.

Producer points:
- account confirmation through `auth.users` trigger.
- captured payments through `finalize_webhook_payment_atomic`.
- payment failure and refund enqueue from the existing Razorpay webhook.

Outbox:
- `idempotency_key` unique.
- Claim token and lease fields.
- Status lifecycle: pending, processing, sent, failed_retryable, failed_permanent.
- Bounded exponential retry with jitter.
- Idempotency-Key sent to Resend on worker requests.
- Worker internal authentication via `EMAIL_WORKER_SECRET` (or service-role fallback where appropriate).

## Worker invocation and scheduling

Worker function: `process-email-outbox`.
Recommended invocation is authenticated internal HTTP POST with bounded batch size. Supabase scheduling/triggering can invoke it, but this task does not perform deployment or create schedules.

Provision `EMAIL_WORKER_SECRET` as an Edge Function secret (or use `CRON_SECRET` if `EMAIL_WORKER_SECRET` is unset). Configure the scheduler to send the same secret in `Authorization: Bearer <secret>` or `x-email-worker-secret: <secret>`; send only one credential. The handler checks a nonempty bearer token first, so a mismatching bearer token results in 401 even if `x-email-worker-secret` matches. The service-role key is accepted only as a fallback when neither worker secret is configured; keep it server-side and prefer a dedicated worker secret. Deploy with `website/supabase/config.toml` so the gateway forwards these requests to the handler for secret verification.

Worker requirements:
- Reject unauthorized requests.
- Process bounded batches.
- Recover expired claims.
- Preserve claim-token fencing.
- Store provider message IDs.
- Use safe backoff and maximum attempts.

Retention cleanup:
- Migration function `cleanup_email_outbox_retention`.
- Operation script `website/supabase/operations/schedule_email_outbox_retention.sql`.
- User deletion redacts stored recipient and metadata immediately.

## Operational runbook

1. Verify Resend domain:
   - Resend dashboard -> Domains -> `notifications.soravo.xyz`, confirm verified, sending enabled, tracking disabled, TLS enforced.

2. Inspect DNS:
   - Cloudflare DNS -> zone `soravo.xyz`, confirm the exact records above are present and DNS-only.

3. Rotate Resend API key:
   - Resend -> API Keys.
   - Create restricted replacement key.
   - Add as Supabase secret `RESEND_API_KEY`.
   - Revoke old key only after verifier key test.
   - Never store key in docs or chat.

4. Configure Supabase SMTP:
   - Supabase dashboard Auth -> SMTP using the values above.
   - Mark configured only after evidence.

5. Apply migrations:
   - Commit-only in repository process.
   - Do not apply to hosted database in this task.

6. Deploy Edge Functions:
   - `razorpay-webhook`, `resend-webhook`, `process-email-outbox`, existing functions.
   - Deployment only after owner approval.

7. Register Resend webhook:
   - only after `resend-webhook` deployment.
   - subscribe only to approved events.
   - save signing secret in Supabase as `RESEND_WEBHOOK_SECRET`.

8. Safe test email:
   - Use owner-controlled disposable recipient only.
   - Invoke worker with test outbox record or isolated payment test fixture.
   - Inspect Resend delivery activity, Supabase logs and outbox status.

9. Recover stuck outbox rows:
   - Stuck rows remain claimable when leases expire.
   - Permanent failures require operator review before retry.
   - Do not manually mark sent without a provider message ID.

10. Disable email during incident:
    - Stop scheduled worker invocations.
    - Existing payment/entitlement processing remains unaffected.
    - Outbox rows stay pending/retryable.

## Documentation update requirement

The older `AUTH_EMAIL_RESEND_SETUP.md` must not retain obsolete `mail.soravo.xyz` or `no-reply@mail.soravo.xyz` instructions. This document is authoritative for Resend infrastructure. If conflict remains, update it to a link-only supplement.

## Current owner actions remaining

- Verify Supabase SMTP saved and delivery tested.
- Rotate any previously exposed Resend key if not confirmed revoked.
- Apply migrations via repository process.
- Deploy functions.
- Register Resend webhook and capture `RESEND_WEBHOOK_SECRET`.
- Schedule/cron retention and worker execution on approved infrastructure.
- Run CodeRabbit and CI on the final PR before integration.
