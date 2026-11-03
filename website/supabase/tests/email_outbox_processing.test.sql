-- Migration 013: confirmation, retry leases, payment notifications, and erasure.
BEGIN;
SELECT plan(18);

INSERT INTO auth.users (id, email) VALUES
  ('10000000-0000-0000-0000-000000000001', NULL),
  ('10000000-0000-0000-0000-000000000002', ''),
  ('10000000-0000-0000-0000-000000000003', 'valid@example.com');
UPDATE auth.users SET email_confirmed_at = now()
WHERE id IN ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003');
SELECT is((SELECT count(*)::int FROM public.email_outbox WHERE template_key = 'welcome' AND user_id IN ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002')), 0, 'confirmation with missing or empty email creates no message');
SELECT is((SELECT count(*)::int FROM public.email_outbox WHERE template_key = 'welcome' AND user_id = '10000000-0000-0000-0000-000000000003'), 1, 'confirmation with email queues welcome');
UPDATE auth.users SET email_confirmed_at = now() WHERE id = '10000000-0000-0000-0000-000000000003';
SELECT is((SELECT count(*)::int FROM public.email_outbox WHERE template_key = 'welcome' AND user_id = '10000000-0000-0000-0000-000000000003'), 1, 'repeated confirmation does not queue again');

-- Clear welcome before selecting claim candidates.
DELETE FROM public.email_outbox;
INSERT INTO public.email_outbox (recipient_email, template_key, idempotency_key, status, attempt_count, lease_expires_at, next_attempt_at, claim_token) VALUES
 ('pending@example.com', 'welcome', 'pending', 'pending', 0, NULL, NULL, NULL),
 ('retry@example.com', 'welcome', 'retry', 'failed_retryable', 2, NULL, now() - interval '1 minute', NULL),
 ('future@example.com', 'welcome', 'future', 'failed_retryable', 2, NULL, now() + interval '1 day', NULL),
 ('expired@example.com', 'welcome', 'expired', 'processing', 7, now() - interval '1 minute', NULL, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('active@example.com', 'welcome', 'active', 'processing', 1, now() + interval '1 hour', NULL, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
 ('capped@example.com', 'welcome', 'capped', 'processing', 8, now() - interval '1 minute', NULL, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
CREATE TEMP TABLE claimed AS SELECT * FROM public.claim_email_outbox_batch(100, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 60);
SELECT is((SELECT count(*)::int FROM claimed), 3, 'claims pending, due retry and expired processing rows');
SELECT is((SELECT attempt_count FROM claimed WHERE idempotency_key = 'expired'), 8, 'expired processing claim increments attempt count');
SELECT is((SELECT claim_token::text FROM claimed WHERE idempotency_key = 'expired'), 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'expired claim rotates token');
SELECT is((SELECT status FROM public.email_outbox WHERE idempotency_key = 'capped'), 'failed_permanent', 'expired final attempt becomes permanent failure');
SELECT is((SELECT claim_token FROM public.email_outbox WHERE idempotency_key = 'capped'), NULL::uuid, 'exhausted claim token invalidated');
SELECT is((SELECT status FROM public.email_outbox WHERE idempotency_key = 'active'), 'processing', 'unexpired processing remains claimed');
SELECT is((SELECT claim_token::text FROM public.email_outbox WHERE idempotency_key = 'active'), 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'unexpired claim token unchanged');
SELECT is((SELECT status FROM public.email_outbox WHERE idempotency_key = 'future'), 'failed_retryable', 'future retry not claimed');

-- The original 11-argument payment call remains unambiguous after upgrade.
SELECT is((SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'finalize_webhook_payment_atomic'), 1, 'one finalize overload remains');
SELECT ok(has_function_privilege('service_role', 'public.finalize_webhook_payment_atomic(text,text,uuid,uuid,text,text,text,integer,text,timestamp with time zone,boolean,boolean,boolean,boolean)', 'EXECUTE'), 'service role can execute replacement finalize');
INSERT INTO public.webhook_events (provider, provider_event_id, event_type, signature_valid, processing_status, claim_token)
VALUES ('razorpay', 'evt-period', 'payment.captured', true, 'processing', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
INSERT INTO public.entitlements (user_id, plan_code, status, issued_at, last_verified_at, subscription_period_end, lifetime)
VALUES ('10000000-0000-0000-0000-000000000003', 'monthly', 'active', now(), now(), now() + interval '10 days', false);
SELECT is(public.finalize_webhook_payment_atomic('razorpay', 'evt-period', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid, '10000000-0000-0000-0000-000000000003'::uuid, 'monthly', 'payment-period', 'order-period', 1200, 'USD', now() + interval '30 days', false, false, false, true), 1, 'renewal payment finalizes');
SELECT is((SELECT (metadata->>'periodEnd')::timestamptz FROM public.email_outbox WHERE idempotency_key = 'subscription_renewed:razorpay:payment-period'), (SELECT subscription_period_end FROM public.entitlements WHERE user_id = '10000000-0000-0000-0000-000000000003' AND plan_code = 'monthly'), 'renewal email uses stored extended period');
SELECT ok((SELECT subscription_period_end = now() + interval '40 days' FROM public.entitlements WHERE user_id = '10000000-0000-0000-0000-000000000003' AND plan_code = 'monthly'), 'existing prepaid period is extended by thirty days');

-- Account erasure redacts even though the foreign key also sets user_id null.
DELETE FROM auth.users WHERE id = '10000000-0000-0000-0000-000000000003';
SELECT is((SELECT recipient_email FROM public.email_outbox WHERE idempotency_key = 'subscription_renewed:razorpay:payment-period'), '[redacted]', 'deletion redacts recipient before foreign key action');
SELECT is((SELECT metadata FROM public.email_outbox WHERE idempotency_key = 'subscription_renewed:razorpay:payment-period'), '{}'::jsonb, 'deletion clears metadata');
SELECT * FROM finish();
ROLLBACK;
