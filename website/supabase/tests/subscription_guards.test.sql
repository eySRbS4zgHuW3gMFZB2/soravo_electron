-- Run after migrations 001–004 in the disposable database.
BEGIN;
SELECT no_plan();
INSERT INTO auth.users (id, email) VALUES
  ('33333333-1111-4111-8111-111111111111', 'subscription-guards@example.invalid');

SELECT is(public.claim_monthly_checkout('33333333-1111-4111-8111-111111111111', gen_random_uuid())->>'status',
  'claimed', 'first request reserves checkout');
SELECT is(public.claim_monthly_checkout('33333333-1111-4111-8111-111111111111', gen_random_uuid())->>'status',
  'busy', 'another request cannot reserve checkout');
SELECT is((SELECT count(*)::integer FROM public.monthly_checkout_reservations), 1, 'one durable reservation');
DELETE FROM public.monthly_checkout_reservations;

INSERT INTO public.entitlements (user_id, plan_code, status, lifetime)
VALUES ('33333333-1111-4111-8111-111111111111', 'lifetime', 'lifetime_active', TRUE);
SELECT is(public.claim_monthly_checkout('33333333-1111-4111-8111-111111111111', gen_random_uuid())->>'status',
  'blocked', 'lifetime entitlement blocks monthly checkout');
UPDATE public.entitlements SET status = 'revoked';
SELECT is(public.claim_monthly_checkout('33333333-1111-4111-8111-111111111111', gen_random_uuid())->>'status',
  'blocked', 'existing lifetime flag retains baseline checkout guard');
DELETE FROM public.entitlements;
INSERT INTO public.entitlements (user_id, plan_code, status)
VALUES ('33333333-1111-4111-8111-111111111111', 'monthly', 'active');
SELECT is(public.claim_monthly_checkout('33333333-1111-4111-8111-111111111111', gen_random_uuid())->>'status',
  'blocked', 'active monthly entitlement blocks checkout');
UPDATE public.entitlements SET status = 'payment_pending';
SELECT is(public.claim_monthly_checkout('33333333-1111-4111-8111-111111111111', gen_random_uuid())->>'status',
  'blocked', 'pending entitlement retains baseline guard');
DELETE FROM public.entitlements;

INSERT INTO public.subscriptions (user_id, provider_subscription_id, plan_code, status)
VALUES ('33333333-1111-4111-8111-111111111111', 'sub_guards', 'monthly', 'created');
SELECT is(public.claim_monthly_checkout('33333333-1111-4111-8111-111111111111', gen_random_uuid())->>'subscription_id',
  'sub_guards', 'created provider ID is reused');
UPDATE public.subscriptions SET status = 'authenticated';
SELECT is(public.claim_monthly_checkout('33333333-1111-4111-8111-111111111111', gen_random_uuid())->>'status',
  'blocked', 'authenticated subscription blocks checkout');
UPDATE public.subscriptions SET status = 'active';
SELECT is(public.claim_monthly_checkout('33333333-1111-4111-8111-111111111111', gen_random_uuid())->>'status',
  'blocked', 'active subscription blocks checkout');

SELECT ok(public.apply_subscription_event('sub_guards', 'cancelled', '2030-01-02Z', NULL, NULL), 'new cancellation applies');
SELECT ok(NOT public.apply_subscription_event('sub_guards', 'active', '2030-01-01Z', NULL, NULL), 'older lifecycle event cannot reactivate');
SELECT ok(NOT public.apply_subscription_event('sub_guards', 'active', '2030-01-01Z',
  '33333333-1111-4111-8111-111111111111', '2030-02-01Z'), 'older captured-payment upsert cannot reactivate');
SELECT ok(NOT public.apply_subscription_event('sub_guards', 'active', '2030-01-02Z',
  '33333333-1111-4111-8111-111111111111', '2030-02-01Z'), 'equal-time active event preserves cancellation');
SELECT ok(NOT public.apply_subscription_event('sub_guards', 'active', NULL,
  '33333333-1111-4111-8111-111111111111', '2030-02-01Z'), 'undated active event preserves cancellation');
SELECT is((SELECT status FROM public.subscriptions WHERE provider_subscription_id = 'sub_guards'), 'cancelled', 'cancellation survives all stale writes');
SELECT is((SELECT last_event_created_at FROM public.subscriptions WHERE provider_subscription_id = 'sub_guards'),
  '2030-01-02Z'::timestamptz, 'watermark does not move backwards');
SELECT is((SELECT current_period_end FROM public.subscriptions WHERE provider_subscription_id = 'sub_guards'),
  NULL::timestamptz, 'stale period end is not written');
SELECT ok(public.apply_subscription_event('sub_guards', 'active', '2030-01-03Z',
  '33333333-1111-4111-8111-111111111111', '2030-02-03Z'), 'newer event can advance state');
SELECT ok(public.apply_subscription_event('sub_guards', 'active', '2030-01-03Z',
  '33333333-1111-4111-8111-111111111111', '2030-02-04Z'), 'same-second active grant can enrich lifecycle metadata');
SELECT ok(public.apply_subscription_event('sub_guards', 'active', '2030-01-03Z',
  '33333333-1111-4111-8111-111111111111', '2030-02-02Z'), 'same-state duplicate remains idempotent');
SELECT is((SELECT current_period_end FROM public.subscriptions WHERE provider_subscription_id = 'sub_guards'),
  '2030-02-04Z'::timestamptz, 'same-second duplicate cannot shorten paid period');
SELECT ok(public.apply_subscription_event('sub_guards', 'cancelled', '2030-01-03Z', NULL, NULL), 'terminal status wins same-second tie');
SELECT is((SELECT current_period_end FROM public.subscriptions WHERE provider_subscription_id = 'sub_guards'),
  '2030-02-04Z'::timestamptz, 'lifecycle update preserves paid period');
DELETE FROM public.subscriptions;

SELECT ok(public.apply_subscription_event('sub_early_cancel', 'cancelled', '2030-01-05Z',
  '33333333-1111-4111-8111-111111111111', NULL), 'cancellation may arrive before checkout has saved the row');
SELECT ok(NOT public.apply_subscription_event('sub_early_cancel', 'active', '2030-01-04Z',
  '33333333-1111-4111-8111-111111111111', '2030-02-04Z'), 'older grant cannot replace that cancellation');
DELETE FROM public.subscriptions;
INSERT INTO public.subscriptions (user_id, provider_subscription_id, plan_code, status)
VALUES ('33333333-1111-4111-8111-111111111111', 'sub_undated', 'monthly', 'created');
SELECT ok(public.apply_subscription_event('sub_undated', 'cancelled', NULL, NULL, NULL), 'undated terminal event can close an undated created checkout');
SELECT ok(NOT public.apply_subscription_event('sub_undated', 'active', '2030-01-04Z',
  '33333333-1111-4111-8111-111111111111', NULL), 'undated terminal state requires reconciliation before reactivation');

SELECT ok(NOT has_function_privilege('authenticated', 'public.claim_monthly_checkout(uuid,uuid)', 'EXECUTE'), 'client cannot claim checkout directly');
SELECT ok(NOT has_function_privilege('anon', 'public.apply_subscription_event(text,text,timestamptz,uuid,timestamptz)', 'EXECUTE'), 'anon cannot set subscription state');
SELECT ok(NOT has_table_privilege('authenticated', 'public.monthly_checkout_reservations', 'DELETE'), 'client cannot clear another request reservation');
SELECT ok(has_function_privilege('service_role', 'public.claim_monthly_checkout(uuid,uuid)', 'EXECUTE'), 'service role can reserve checkout');
SELECT ok(has_function_privilege('service_role', 'public.apply_subscription_event(text,text,timestamptz,uuid,timestamptz)', 'EXECUTE'), 'service role can reconcile state');
SET LOCAL ROLE service_role;
SELECT is(public.claim_monthly_checkout('33333333-1111-4111-8111-111111111111', gen_random_uuid())->>'status',
  'claimed', 'service role executes the privileged claim');
SELECT lives_ok($$DELETE FROM public.monthly_checkout_reservations
  WHERE user_id = '33333333-1111-4111-8111-111111111111' AND request_id IS NOT NULL$$,
  'service role can release a reservation with ownership filters');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
