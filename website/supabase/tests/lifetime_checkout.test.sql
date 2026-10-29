-- Run after migrations 001–006 in a disposable database.
BEGIN;
SELECT no_plan();
SELECT throws_ok(
  $$SELECT public.claim_lifetime_checkout('44444444-0000-4000-8000-000000000000', gen_random_uuid())$$,
  'P0001', 'Unknown user', 'unknown users cannot claim lifetime checkout');
INSERT INTO auth.users (id, email) VALUES
  ('44444444-1111-4111-8111-111111111111', 'lifetime-checkout@example.invalid'),
  ('44444444-2222-4222-8222-222222222222', 'other-lifetime@example.invalid');

SELECT is(public.claim_lifetime_checkout('44444444-1111-4111-8111-111111111111',
  '44444444-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->>'status', 'claimed', 'empty entitlements allow checkout');
SELECT is(public.claim_lifetime_checkout('44444444-1111-4111-8111-111111111111', gen_random_uuid())->>'status',
  'busy', 'a second request cannot reserve the same account');
SELECT is((SELECT count(*)::integer FROM public.lifetime_checkout_reservations), 1, 'one durable claim');
SELECT is(public.claim_lifetime_checkout('44444444-2222-4222-8222-222222222222', gen_random_uuid())->>'status',
  'claimed', 'another user can independently reserve checkout');
DELETE FROM public.lifetime_checkout_reservations;

INSERT INTO public.entitlements (user_id, plan_code, status, lifetime)
VALUES ('44444444-1111-4111-8111-111111111111', 'lifetime', 'lifetime_active', TRUE);
SELECT is(public.claim_lifetime_checkout('44444444-1111-4111-8111-111111111111', gen_random_uuid())->>'status',
  'blocked', 'active lifetime entitlement blocks checkout');
UPDATE public.entitlements SET status = 'active', lifetime = FALSE;
SELECT is(public.claim_lifetime_checkout('44444444-1111-4111-8111-111111111111', gen_random_uuid())->>'status',
  'blocked', 'active status blocks regardless of lifetime flag');
UPDATE public.entitlements SET status = 'revoked', lifetime = TRUE;
SELECT is(public.claim_lifetime_checkout('44444444-1111-4111-8111-111111111111', gen_random_uuid())->>'status',
  'claimed', 'revoked lifetime flag permits repurchase');
DELETE FROM public.lifetime_checkout_reservations;
DELETE FROM public.entitlements;
INSERT INTO public.entitlements (user_id, plan_code, status)
VALUES ('44444444-1111-4111-8111-111111111111', 'monthly', 'active');
SELECT is(public.claim_lifetime_checkout('44444444-1111-4111-8111-111111111111', gen_random_uuid())->>'status',
  'claimed', 'active monthly access permits lifetime upgrade');
DELETE FROM public.lifetime_checkout_reservations;
DELETE FROM public.entitlements;

INSERT INTO public.payments (user_id, provider_payment_id, provider_order_id, amount_minor, currency, status)
VALUES ('44444444-1111-4111-8111-111111111111', 'order_lifetime', 'order_lifetime', 5000, 'USD', 'pending');
SELECT is(public.claim_lifetime_checkout('44444444-1111-4111-8111-111111111111', gen_random_uuid())->>'order_id',
  'order_lifetime', 'retry reuses a saved unpaid order');
SELECT is((SELECT count(*)::integer FROM public.lifetime_checkout_reservations), 0, 'reuse needs no new reservation');
UPDATE public.payments SET status = 'failed';
SELECT is(public.claim_lifetime_checkout('44444444-1111-4111-8111-111111111111', gen_random_uuid())->>'order_id',
  'order_lifetime', 'failed payment attempt may retry the same order');
INSERT INTO public.payments (user_id, provider_payment_id, provider_order_id, amount_minor, currency, status)
VALUES ('44444444-1111-4111-8111-111111111111', 'pay_captured', 'order_lifetime', 5000, 'USD', 'captured');
SELECT is(public.claim_lifetime_checkout('44444444-1111-4111-8111-111111111111', gen_random_uuid())->>'status',
  'claimed', 'a captured order is not reused even if a failed placeholder remains');
DELETE FROM public.lifetime_checkout_reservations;
DELETE FROM public.payments;

-- Other users, monthly amounts, currencies and subscriptions must not be reused.
INSERT INTO public.payments (user_id, provider_payment_id, provider_order_id, provider_subscription_id, amount_minor, currency, status)
VALUES
  ('44444444-2222-4222-8222-222222222222', 'order_other', 'order_other', NULL, 5000, 'USD', 'pending'),
  ('44444444-1111-4111-8111-111111111111', 'order_monthly', 'order_monthly', NULL, 1200, 'USD', 'pending'),
  ('44444444-1111-4111-8111-111111111111', 'order_currency', 'order_currency', NULL, 5000, 'INR', 'pending'),
  ('44444444-1111-4111-8111-111111111111', 'order_subscription', 'order_subscription', 'sub_test', 5000, 'USD', 'pending');
SELECT is(public.claim_lifetime_checkout('44444444-1111-4111-8111-111111111111', gen_random_uuid())->>'status',
  'claimed', 'only a matching lifetime order can be reused');
DELETE FROM public.lifetime_checkout_reservations;

SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.lifetime_checkout_reservations'::regclass),
  'reservation table enables RLS');
SELECT ok(NOT has_function_privilege('anon', 'public.claim_lifetime_checkout(uuid,uuid)', 'EXECUTE'),
  'anon cannot claim lifetime checkout');
SELECT ok(NOT has_function_privilege('authenticated', 'public.claim_lifetime_checkout(uuid,uuid)', 'EXECUTE'),
  'authenticated clients cannot claim arbitrary users');
SELECT ok(NOT has_table_privilege('authenticated', 'public.lifetime_checkout_reservations', 'DELETE'),
  'clients cannot release reservations');
SELECT ok(NOT has_table_privilege('anon', 'public.lifetime_checkout_reservations', 'SELECT'),
  'anon cannot read reservations');
SET LOCAL ROLE service_role;
SELECT is(public.claim_lifetime_checkout('44444444-1111-4111-8111-111111111111',
  '44444444-aaaa-4aaa-8aaa-aaaaaaaaaaaa')->>'status', 'claimed', 'service role can claim checkout');
DELETE FROM public.lifetime_checkout_reservations WHERE user_id = '44444444-1111-4111-8111-111111111111'
  AND request_id = '44444444-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
SELECT is((SELECT count(*)::integer FROM public.lifetime_checkout_reservations), 1, 'wrong request ID cannot release a claim');
SELECT lives_ok($$DELETE FROM public.lifetime_checkout_reservations
  WHERE user_id = '44444444-1111-4111-8111-111111111111'
  AND request_id = '44444444-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$, 'service role releases its matching claim');
RESET ROLE;
SELECT is((SELECT count(*)::integer FROM public.lifetime_checkout_reservations), 0, 'matching claim was released');
SELECT * FROM finish();
ROLLBACK;
