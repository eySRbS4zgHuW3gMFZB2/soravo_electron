BEGIN;
SELECT no_plan();

SET LOCAL ROLE anon;
SELECT throws_ok($$SELECT public.admin_dashboard_overview()$$, '42501', NULL, 'anon cannot read aggregate');
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.admin_dashboard_overview()$$, '42501', NULL, 'ordinary users cannot read aggregate');
RESET ROLE;

SET LOCAL ROLE service_role;
SELECT is(public.admin_dashboard_overview()->>'paymentTotalMinor', '0', 'empty payment sum is zero');
SELECT is(public.admin_dashboard_overview()->'subscriptionBreakdown', '{}'::jsonb, 'empty breakdown is an object');
SELECT is(public.admin_dashboard_overview()->'newUsersByDay', '[]'::jsonb, 'empty signup series is an array');
RESET ROLE;

INSERT INTO auth.users (id, email)
SELECT md5(i::text)::uuid, 'aggregate-' || i || '@example.invalid' FROM generate_series(1, 1005) i;
UPDATE public.profiles SET created_at = now() - interval '40 days' WHERE user_id = md5('1')::uuid;
UPDATE public.profiles SET created_at = now() - interval '20 days' WHERE user_id = md5('2')::uuid;
UPDATE public.profiles SET created_at = now() - interval '15 days' WHERE user_id = md5('3')::uuid;
UPDATE public.profiles SET created_at = now() - interval '13 days' WHERE user_id = md5('4')::uuid;
INSERT INTO public.devices (user_id, device_id) SELECT id, 'active' FROM auth.users;
INSERT INTO public.devices (user_id, device_id, revoked_at) VALUES
  (md5('1')::uuid, 'second-active', NULL), (md5('1')::uuid, 'revoked', now());
INSERT INTO public.entitlements (user_id, plan_code, status) SELECT id, 'monthly', 'active' FROM auth.users;
INSERT INTO public.entitlements (user_id, plan_code, status, lifetime) VALUES (md5('1')::uuid, 'lifetime', 'lifetime_active', true);
INSERT INTO public.payments (user_id, provider_payment_id, amount_minor, status)
SELECT id, 'pay-' || id, 3000000, 'captured' FROM auth.users;
INSERT INTO public.payments (user_id, provider_payment_id, provider_subscription_id, amount_minor, status) VALUES
  (md5('1')::uuid, 'recurring', 'sub-1', 1200, 'captured'),
  (md5('1')::uuid, 'empty-sub', '', 50, 'captured'),
  (md5('1')::uuid, 'failed', NULL, 999, 'failed'),
  (md5('1')::uuid, 'refunded', NULL, 200, 'refunded'),
  (md5('1')::uuid, 'chargeback', NULL, 100, 'chargeback'),
  (md5('1')::uuid, 'pending', NULL, 100, 'pending');
INSERT INTO public.subscriptions (user_id, provider_subscription_id, plan_code, status) SELECT id, 'sub-' || id, 'monthly', 'active' FROM auth.users;
INSERT INTO public.subscriptions (user_id, provider_subscription_id, plan_code, status) VALUES (md5('1')::uuid, 'cancelled', 'monthly', 'cancelled');
INSERT INTO public.webhook_events (provider_event_id, event_type, processing_status)
SELECT 'event-' || i, 'payment.captured', 'processed' FROM generate_series(1, 1005) i;
INSERT INTO public.webhook_events (provider_event_id, event_type, processing_status) VALUES ('failed', 'payment.failed', 'failed');

SET LOCAL ROLE service_role;
SELECT is(public.admin_dashboard_overview()->>'totalUsers', '1005', 'user count exceeds REST cap');
SELECT is(public.admin_dashboard_overview()->>'newUsers30d', '1004', '30-day signup window is preserved');
SELECT is(public.admin_dashboard_overview()->>'totalDevices', '1007', 'all device rows are counted');
SELECT is(public.admin_dashboard_overview()->>'activeDevices', '1006', 'revoked devices are excluded');
SELECT is(public.admin_dashboard_overview()->>'activeUsers', '1005', 'active users are distinct');
SELECT is(public.admin_dashboard_overview()->>'monthlyEntitlements', '1005', 'monthly count exceeds cap');
SELECT is(public.admin_dashboard_overview()->>'lifetimeEntitlements', '1', 'lifetime count is preserved');
SELECT is(public.admin_dashboard_overview()->>'totalPayments', '1011', 'all payment statuses count');
SELECT is(public.admin_dashboard_overview()->>'paymentTotalMinor', '3015001250', 'captured sum exceeds 32-bit integer and REST cap');
SELECT is(public.admin_dashboard_overview()->>'capturedPayments', '1007', 'captured count exceeds cap');
SELECT is(public.admin_dashboard_overview()->>'failedPayments', '1', 'failed count is separate');
SELECT is(public.admin_dashboard_overview()->>'refundedPayments', '1', 'refunded count is separate');
SELECT is(public.admin_dashboard_overview()->>'lifetimePaymentCount', '1006', 'null and empty subscription IDs count as lifetime');
SELECT is(public.admin_dashboard_overview()->>'recurringPaymentCount', '1', 'subscription payments count separately');
SELECT is(public.admin_dashboard_overview()->>'lifetimePaymentTotalMinor', '3015000050', 'lifetime payment sum is complete');
SELECT is(public.admin_dashboard_overview()->>'recurringPaymentTotalMinor', '1200', 'recurring payment sum is complete');
SELECT is(public.admin_dashboard_overview()->'subscriptionBreakdown', '{"active":1005,"cancelled":1}'::jsonb, 'all subscriptions are grouped');
SELECT is(public.admin_dashboard_overview()->'webhookBreakdown', '{"processed":1005,"failed":1}'::jsonb, 'all webhook events are grouped');
SELECT is(public.admin_dashboard_overview()->'newUsersByDay', jsonb_build_array(
  jsonb_build_object('date', ((now() - interval '13 days') AT TIME ZONE 'UTC')::date, 'count', 1),
  jsonb_build_object('date', (now() AT TIME ZONE 'UTC')::date, 'count', 1001)
), '14-day series is complete, ordered, and grouped by UTC date');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
