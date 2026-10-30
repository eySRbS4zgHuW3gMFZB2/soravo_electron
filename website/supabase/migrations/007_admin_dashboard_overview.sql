-- Service-role-only aggregate endpoint for the admin dashboard. Return one JSON
-- value so PostgREST's table row cap cannot truncate totals or breakdowns.
-- The Edge Function must authorize the admin and audit the read before responding.
BEGIN;

CREATE OR REPLACE FUNCTION public.admin_dashboard_overview()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH profile_totals AS (
    SELECT count(*) AS total,
      count(*) FILTER (WHERE created_at >= now() - interval '30 days') AS recent
    FROM public.profiles
  ), device_totals AS (
    SELECT count(*) AS total,
      count(*) FILTER (WHERE revoked_at IS NULL) AS active,
      count(DISTINCT user_id) FILTER (WHERE revoked_at IS NULL) AS users
    FROM public.devices
  ), entitlement_totals AS (
    SELECT count(*) FILTER (WHERE lifetime OR status = 'lifetime_active') AS lifetime,
      count(*) FILTER (WHERE plan_code = 'monthly') AS monthly
    FROM public.entitlements
  ), payment_totals AS (
    SELECT count(*) AS total,
      count(*) FILTER (WHERE status = 'captured') AS captured,
      coalesce(sum(amount_minor) FILTER (WHERE status = 'captured'), 0) AS amount,
      count(*) FILTER (WHERE status = 'failed') AS failed,
      count(*) FILTER (WHERE status = 'refunded') AS refunded,
      count(*) FILTER (WHERE status = 'captured' AND coalesce(provider_subscription_id, '') = '') AS lifetime_count,
      count(*) FILTER (WHERE status = 'captured' AND coalesce(provider_subscription_id, '') <> '') AS recurring_count,
      coalesce(sum(amount_minor) FILTER (WHERE status = 'captured' AND coalesce(provider_subscription_id, '') = ''), 0) AS lifetime_amount,
      coalesce(sum(amount_minor) FILTER (WHERE status = 'captured' AND coalesce(provider_subscription_id, '') <> ''), 0) AS recurring_amount
    FROM public.payments
  ), subscription_counts AS (
    SELECT status, count(*) AS count FROM public.subscriptions GROUP BY status
  ), webhook_counts AS (
    SELECT processing_status, count(*) AS count FROM public.webhook_events GROUP BY processing_status
  ), signup_counts AS (
    SELECT (created_at AT TIME ZONE 'UTC')::date AS date, count(*) AS count
    FROM public.profiles
    WHERE created_at >= now() - interval '14 days'
    GROUP BY (created_at AT TIME ZONE 'UTC')::date
  )
  SELECT jsonb_build_object(
    'totalUsers', p.total, 'newUsers30d', p.recent,
    'activeUsers', d.users, 'activeDevices', d.active, 'totalDevices', d.total,
    'lifetimeEntitlements', e.lifetime, 'monthlyEntitlements', e.monthly,
    'paymentTotalMinor', pay.amount, 'capturedPayments', pay.captured,
    'failedPayments', pay.failed, 'refundedPayments', pay.refunded, 'totalPayments', pay.total,
    'lifetimePaymentCount', pay.lifetime_count, 'recurringPaymentCount', pay.recurring_count,
    'lifetimePaymentTotalMinor', pay.lifetime_amount, 'recurringPaymentTotalMinor', pay.recurring_amount,
    'subscriptionBreakdown', coalesce((SELECT jsonb_object_agg(status, count) FROM subscription_counts), '{}'::jsonb),
    'webhookBreakdown', coalesce((SELECT jsonb_object_agg(processing_status, count) FROM webhook_counts), '{}'::jsonb),
    'newUsersByDay', coalesce((SELECT jsonb_agg(jsonb_build_object('date', date, 'count', count) ORDER BY date) FROM signup_counts), '[]'::jsonb)
  )
  FROM profile_totals p CROSS JOIN device_totals d CROSS JOIN entitlement_totals e CROSS JOIN payment_totals pay;
$$;

REVOKE ALL ON FUNCTION public.admin_dashboard_overview() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_overview() TO service_role;

COMMIT;
