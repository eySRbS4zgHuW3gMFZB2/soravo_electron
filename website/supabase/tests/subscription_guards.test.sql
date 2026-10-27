-- Apply all migrations and enable pgTAP before running with pg_prove.
BEGIN;
SELECT plan(7);

INSERT INTO auth.users (id, email)
VALUES ('33333333-2222-3333-4444-555555555555', 'subscription-guards@example.com');

INSERT INTO public.subscriptions (user_id, provider_subscription_id, plan_code, status)
VALUES ('33333333-2222-3333-4444-555555555555', 'sub_existing', 'monthly', 'created');

SELECT throws_ok(
  format($sql$
    INSERT INTO public.subscriptions (user_id, provider_subscription_id, plan_code, status)
    VALUES ('33333333-2222-3333-4444-555555555555', 'sub_duplicate', 'monthly', %L)
  $sql$, status),
  '23505', NULL, 'rejects another billable subscription in status ' || status
)
FROM unnest(ARRAY['created', 'authenticated', 'active', 'pending', 'resumed']) AS statuses(status);

SELECT lives_ok($sql$
  INSERT INTO public.subscriptions (user_id, provider_subscription_id, plan_code, status)
  VALUES ('33333333-2222-3333-4444-555555555555', 'sub_cancelled', 'monthly', 'cancelled')
$sql$, 'allows a cancelled historical subscription');

UPDATE public.subscriptions SET status = 'cancelled' WHERE provider_subscription_id = 'sub_existing';
SELECT lives_ok($sql$
  INSERT INTO public.subscriptions (user_id, provider_subscription_id, plan_code, status)
  VALUES ('33333333-2222-3333-4444-555555555555', 'sub_replacement', 'monthly', 'pending')
$sql$, 'allows a pending subscription after cancellation');

SELECT * FROM finish();
ROLLBACK;
