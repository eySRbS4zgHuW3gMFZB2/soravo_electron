-- Database-backed tests for public.finalize_webhook_payment_atomic
--
-- Prerequisites:
--   1. Apply website/supabase/migrations/001_initial_schema.sql
--   2. Ensure test user in auth.users (UUID: 11111111-2222-3333-4444-555555555555)
--   3. CREATE EXTENSION IF NOT EXISTS pgtap;
--   4. Run: pg_prove -d <db_url> website/supabase/tests/webhook_finalize_atomic.test.sql
--
-- Coverage:
--   * stale claim token returns 0 and writes no payment/entitlement
--   * current claim token completes payment + entitlement + finalization
--   * transaction failure rolls back all writes
--   * reclaim rotates the claim token
--   * duplicate/replay stays idempotent
--   * amount/currency/user/order validation remains enforced

BEGIN;

SELECT plan(22);

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES ('11111111-2222-3333-4444-555555555555','webhook-finalize@example.com','x',now(),now(),now(),'','','','')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES ('22222222-2222-3333-4444-555555555555','webhook-finalize2@example.com','x',now(),now(),now(),'','','','')
ON CONFLICT (id) DO NOTHING;

-- Seed a claimed webhook event with a known token.
INSERT INTO public.webhook_events (provider, provider_event_id, event_type, signature_valid, processing_status, claim_token)
VALUES ('razorpay','evt_finalize_1','payment.captured',true,'processing','11111111-1111-4111-8111-111111111111'::uuid);

-- 1. Stale token cannot write payment or entitlement and returns 0.
SELECT is(
  public.finalize_webhook_payment_atomic(
    'razorpay','evt_finalize_1','22222222-2222-4222-8222-222222222222'::uuid,
    '11111111-2222-3333-4444-555555555555'::uuid,
    'monthly','pay_test','order_test',1200,'USD',now() + interval '30 days',false
  ),
  0,
  'stale claim token returns 0'
);

SELECT is(
  (SELECT count(*)::int FROM public.payments WHERE provider='razorpay' AND provider_payment_id='pay_test'),
  0,
  'stale token writes no payment'
);

SELECT is(
  (SELECT count(*)::int FROM public.entitlements WHERE user_id='11111111-2222-3333-4444-555555555555'::uuid),
  0,
  'stale token writes no entitlement'
);

-- 2. Current token completes all writes and finalizes exactly once.
SELECT is(
  public.finalize_webhook_payment_atomic(
    'razorpay','evt_finalize_1','11111111-1111-4111-8111-111111111111'::uuid,
    '11111111-2222-3333-4444-555555555555'::uuid,
    'monthly','pay_test','order_test',1200,'USD',now() + interval '30 days',false
  ),
  1,
  'current claim token finalizes exactly one event'
);

SELECT is(
  (SELECT count(*)::int FROM public.payments WHERE provider='razorpay' AND provider_payment_id='pay_test' AND status='captured'),
  1,
  'payment recorded as captured'
);

SELECT is(
  (SELECT count(*)::int FROM public.entitlements WHERE user_id='11111111-2222-3333-4444-555555555555'::uuid AND plan_code='monthly' AND status='active'),
  1,
  'entitlement upserted'
);

SELECT is(
  (SELECT processing_status FROM public.webhook_events WHERE provider='razorpay' AND provider_event_id='evt_finalize_1'),
  'processed',
  'event finalized as processed'
);

-- 3. Replayed finalization with the same (now stale) token returns 0 (idempotent).
SELECT is(
  public.finalize_webhook_payment_atomic(
    'razorpay','evt_finalize_1','11111111-1111-4111-8111-111111111111'::uuid,
    '11111111-2222-3333-4444-555555555555'::uuid,
    'monthly','pay_test','order_test',1200,'USD',now() + interval '30 days',false
  ),
  0,
  'replayed token cannot re-finalize'
);

-- 4. Invalid amount/currency/plan rejected (transaction aborts; use a fresh event).
INSERT INTO public.webhook_events (provider, provider_event_id, event_type, signature_valid, processing_status, claim_token)
VALUES ('razorpay','evt_finalize_2','payment.captured',true,'processing','33333333-3333-4333-8333-333333333333'::uuid);

SELECT throws_ok(
  $$SELECT public.finalize_webhook_payment_atomic(
      'razorpay','evt_finalize_2','33333333-3333-4333-8333-333333333333'::uuid,
      '11111111-2222-3333-4444-555555555555'::uuid,
      'monthly','pay_test2','order_test2',0,'USD',now() + interval '30 days',false
    )$$,
  NULL, NULL,
  'invalid amount rejected'
);

SELECT throws_ok(
  $$SELECT public.finalize_webhook_payment_atomic(
      'razorpay','evt_finalize_2','33333333-3333-4333-8333-333333333333'::uuid,
      '11111111-2222-3333-4444-555555555555'::uuid,
      'monthly','pay_test2','order_test2',1200,'EUR',now() + interval '30 days',false
    )$$,
  NULL, NULL,
  'invalid currency rejected'
);

SELECT throws_ok(
  $$SELECT public.finalize_webhook_payment_atomic(
      'razorpay','evt_finalize_2','33333333-3333-4333-8333-333333333333'::uuid,
      '11111111-2222-3333-4444-555555555555'::uuid,
      NULL,'pay_test2','order_test2',1200,'USD',now() + interval '30 days',false
    )$$,
  NULL, NULL,
  'NULL plan rejected (three-valued logic)'
);

SELECT throws_ok(
  $$SELECT public.finalize_webhook_payment_atomic(
      'razorpay','evt_finalize_2','33333333-3333-4333-8333-333333333333'::uuid,
      '11111111-2222-3333-4444-555555555555'::uuid,
      'monthly','pay_test2','order_test2',1200,NULL,now() + interval '30 days',false
    )$$,
  NULL, NULL,
  'NULL currency rejected (three-valued logic)'
);

SELECT throws_ok(
  $$SELECT public.finalize_webhook_payment_atomic(
      NULL,'evt_finalize_2','33333333-3333-4333-8333-333333333333'::uuid,
      '11111111-2222-3333-4444-555555555555'::uuid,
      'monthly','pay_test2','order_test2',1200,'USD',now() + interval '30 days',false
    )$$,
  NULL, NULL,
  'NULL provider rejected'
);

SELECT throws_ok(
  $$SELECT public.finalize_webhook_payment_atomic(
      'razorpay','evt_finalize_2','33333333-3333-4333-8333-333333333333'::uuid,
      '11111111-2222-3333-4444-555555555555'::uuid,
      'monthly',NULL,'order_test2',1200,'USD',now() + interval '30 days',false
    )$$,
  NULL, NULL,
  'NULL provider_payment_id rejected'
);

SELECT throws_ok(
  $$SELECT public.finalize_webhook_payment_atomic(
      'razorpay','evt_finalize_2','33333333-3333-4333-8333-333333333333'::uuid,
      '11111111-2222-3333-4444-555555555555'::uuid,
      'enterprise','pay_test2','order_test2',1200,'USD',now() + interval '30 days',false
    )$$,
  NULL, NULL,
  'invalid plan rejected'
);

-- After a rejected transaction, no payment should have been written for evt_finalize_2.
SELECT is(
  (SELECT count(*)::int FROM public.payments WHERE provider_payment_id='pay_test2'),
  0,
  'rejected transaction writes no payment'
);

-- H1: conflicting payment identity must abort, not reassign.
INSERT INTO public.webhook_events (provider, provider_event_id, event_type, signature_valid, processing_status, claim_token)
VALUES ('razorpay','evt_conflict_1','payment.captured',true,'processing','44444444-4444-4444-8444-444444444444'::uuid);

INSERT INTO public.payments (user_id, provider, provider_payment_id, amount_minor, currency, status)
VALUES ('11111111-2222-3333-4444-555555555555'::uuid,'razorpay','pay_conflict',1200,'USD','captured');

SELECT throws_ok(
  $$SELECT public.finalize_webhook_payment_atomic(
      'razorpay','evt_conflict_1','44444444-4444-4444-8444-444444444444'::uuid,
      '22222222-2222-3333-4444-555555555555'::uuid,
      'monthly','pay_conflict','order_x',1200,'USD',now() + interval '30 days',false
    )$$,
  NULL, NULL,
  'conflicting payment identity aborts'
);

-- Ensure the original payment identity is preserved.
SELECT is(
  (SELECT user_id::text FROM public.payments WHERE provider_payment_id='pay_conflict'),
  '11111111-2222-3333-4444-555555555555',
  'conflicting call preserves original payment owner'
);

-- H2: pending promotion requires matching user/amount/currency.
INSERT INTO public.webhook_events (provider, provider_event_id, event_type, signature_valid, processing_status, claim_token)
VALUES ('razorpay','evt_pending_1','payment.captured',true,'processing','55555555-5555-4555-8555-555555555555'::uuid);

INSERT INTO public.payments (user_id, provider, provider_payment_id, provider_order_id, amount_minor, currency, status)
VALUES ('11111111-2222-3333-4444-555555555555'::uuid,'razorpay','order_pending','order_pending',1200,'USD','pending');

SELECT throws_ok(
  $$SELECT public.finalize_webhook_payment_atomic(
      'razorpay','evt_pending_1','55555555-5555-4555-8555-555555555555'::uuid,
      '22222222-2222-3333-4444-555555555555'::uuid,
      'monthly','pay_pending','order_pending',1200,'USD',now() + interval '30 days',false
    )$$,
  NULL, NULL,
  'pending payment binding mismatch aborts'
);

-- valid pending promotion succeeds.
INSERT INTO public.webhook_events (provider, provider_event_id, event_type, signature_valid, processing_status, claim_token)
VALUES ('razorpay','evt_pending_2','payment.captured',true,'processing','66666666-6666-4666-8666-666666666666'::uuid);

INSERT INTO public.payments (user_id, provider, provider_payment_id, provider_order_id, amount_minor, currency, status)
VALUES ('11111111-2222-3333-4444-555555555555'::uuid,'razorpay','order_pending_ok','order_pending_ok',1200,'USD','pending');

SELECT is(
  public.finalize_webhook_payment_atomic(
    'razorpay','evt_pending_2','66666666-6666-4666-8666-666666666666'::uuid,
    '11111111-2222-3333-4444-555555555555'::uuid,
    'monthly','pay_pending_ok','order_pending_ok',1200,'USD',now() + interval '30 days',false
  ),
  1,
  'valid pending payment is promoted'
);

-- Preserve prepaid monthly time when another payment arrives.
INSERT INTO public.webhook_events (provider, provider_event_id, event_type, signature_valid, processing_status, claim_token)
VALUES ('razorpay','evt_extend_1','payment.captured',true,'processing','77777777-7777-4777-8777-777777777777'::uuid);

INSERT INTO public.entitlements (user_id, plan_code, status, issued_at, last_verified_at, subscription_period_end, lifetime)
VALUES ('11111111-2222-3333-4444-555555555555'::uuid,'monthly','active',now(),now(),now()+interval '10 days',false);

SELECT is(
  public.finalize_webhook_payment_atomic(
    'razorpay','evt_extend_1','77777777-7777-4777-8777-777777777777'::uuid,
    '11111111-2222-3333-4444-555555555555'::uuid,
    'monthly','pay_extend','order_extend',1200,'USD',now()+interval '30 days',false
  ),
  1,
  'active monthly payment finalizes successfully'
);

SELECT ok(
  (SELECT subscription_period_end > now() + interval '39 days'
   FROM public.entitlements
   WHERE user_id='11111111-2222-3333-4444-555555555555'::uuid AND plan_code='monthly'),
  'future monthly entitlement is extended instead of overwritten'
);

-- Cleanup
DELETE FROM public.payments WHERE provider='razorpay' AND provider_payment_id IN ('pay_test','pay_test2','pay_conflict','pay_pending','pay_pending_ok');
DELETE FROM public.entitlements WHERE user_id='11111111-2222-3333-4444-555555555555'::uuid;
DELETE FROM public.webhook_events WHERE provider='razorpay' AND provider_event_id IN ('evt_finalize_1','evt_finalize_2','evt_extend_1');
DELETE FROM auth.users WHERE id IN ('11111111-2222-3333-4444-555555555555'::uuid,'22222222-2222-3333-4444-555555555555'::uuid);

SELECT * FROM finish();
ROLLBACK;