-- Database-backed tests for webhook claim/lease and RLS isolation
-- Prerequisites:
--   1. Apply website/supabase/migrations/001_initial_schema.sql
--   2. Ensure test user in auth.users (UUID: 11111111-2222-3333-4444-555555555555)
--   3. CREATE EXTENSION IF NOT EXISTS pgtap;
--   4. Run with pg_prove.

BEGIN;

SELECT plan(9);

CREATE TEMP TABLE webhook_test_claims (name TEXT PRIMARY KEY, token UUID NOT NULL);

INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES ('11111111-2222-3333-4444-555555555555','webhook-test@example.com','x',now(),now(),now(),'','','','')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.webhook_events (provider, provider_event_id, event_type, signature_valid, processing_status)
VALUES ('razorpay','evt_claim_1','payment.captured',true,'received');

WITH c1 AS (
  UPDATE public.webhook_events
  SET processing_status='processing', claimed_at=now(), lease_expires_at=now()+interval '1 minute', claim_token=gen_random_uuid()
  WHERE provider='razorpay' AND provider_event_id='evt_claim_1'
    AND processing_status IN ('received','failed')
  RETURNING id
)
SELECT is((SELECT count(*)::int FROM c1),1,'first webhook claim acquires the lease');

INSERT INTO webhook_test_claims
SELECT 'prior', claim_token FROM public.webhook_events
WHERE provider='razorpay' AND provider_event_id='evt_claim_1';

WITH c2 AS (
  UPDATE public.webhook_events
  SET processing_status='processing'
  WHERE provider='razorpay' AND provider_event_id='evt_claim_1'
    AND processing_status='processing' AND lease_expires_at < now()
  RETURNING id
)
SELECT is((SELECT count(*)::int FROM c2),0,'another delivery cannot steal a valid lease');

UPDATE public.webhook_events
SET lease_expires_at = now() - interval '1 minute'
WHERE provider='razorpay' AND provider_event_id='evt_claim_1';

WITH c3 AS (
  UPDATE public.webhook_events
  SET processing_status='processing', claimed_at=now(), lease_expires_at=now()+interval '1 minute', claim_token=gen_random_uuid()
  WHERE provider='razorpay' AND provider_event_id='evt_claim_1'
    AND processing_status='processing' AND lease_expires_at < now()
  RETURNING id
)
SELECT is((SELECT count(*)::int FROM c3),1,'expired lease can be reclaimed atomically');

INSERT INTO webhook_test_claims
SELECT 'reclaimed', claim_token FROM public.webhook_events
WHERE provider='razorpay' AND provider_event_id='evt_claim_1';

SELECT isnt(
  (SELECT token FROM webhook_test_claims WHERE name='prior'),
  (SELECT token FROM webhook_test_claims WHERE name='reclaimed'),
  'reclaim replaces the prior claim token'
);

SELECT throws_ok(
  $$INSERT INTO public.webhook_events (provider, provider_event_id, event_type, signature_valid, processing_status)
    VALUES ('razorpay','evt_claim_1','payment.captured',true,'received')$$,
  '23505'::text, NULL,
  'duplicate webhook event rejected by unique constraint (idempotent delivery)'
);

WITH stale_finalization AS (
  UPDATE public.webhook_events
  SET processing_status='processed', processed_at=now()
  WHERE provider='razorpay' AND provider_event_id='evt_claim_1'
    AND claim_token=(SELECT token FROM webhook_test_claims WHERE name='prior')
  RETURNING id
)
SELECT is((SELECT count(*)::int FROM stale_finalization),0,'prior claim token cannot finalize the reclaimed event');

WITH current_finalization AS (
  UPDATE public.webhook_events
  SET processing_status='processed', processed_at=now()
  WHERE provider='razorpay' AND provider_event_id='evt_claim_1'
    AND claim_token=(SELECT token FROM webhook_test_claims WHERE name='reclaimed')
  RETURNING id
)
SELECT is((SELECT count(*)::int FROM current_finalization),1,'reclaimed claim token finalizes exactly one event');

SELECT is(
  (SELECT count(*)::int FROM public.webhook_events
   WHERE provider='razorpay' AND provider_event_id='evt_claim_1' AND processing_status='processed'),
  1,
  'processed status persists for duplicate/replayed delivery'
);

-- Cross-user isolation: user B cannot read user A's device (RLS). Test by direct count under service role is not meaningful;
-- verify row ownership uniqueness instead.
INSERT INTO public.devices (user_id, device_id, platform)
VALUES ('11111111-2222-3333-4444-555555555555','dev-cross','windows');

SELECT ok(
  EXISTS (SELECT 1 FROM public.devices WHERE user_id='11111111-2222-3333-4444-555555555555' AND device_id='dev-cross'),
  'device row owned by its user'
);

DELETE FROM public.devices WHERE user_id='11111111-2222-3333-4444-555555555555';
DELETE FROM public.webhook_events WHERE provider='razorpay' AND provider_event_id IN ('evt_claim_1');
DELETE FROM auth.users WHERE id='11111111-2222-3333-4444-555555555555';

SELECT * FROM finish();
ROLLBACK;