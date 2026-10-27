-- Additive guardrails for recurring billing reconciliation and duplicate
-- subscription prevention.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS last_event_created_at TIMESTAMPTZ;

-- At most one pending/active monthly subscription per user. This is the race-safe
-- counterpart of the Edge Function guard and protects against concurrent checkout
-- requests even if an exception escapes the function.
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_one_open_monthly_per_user
  ON public.subscriptions (user_id)
  WHERE status IN ('created', 'authenticated', 'active');

CREATE INDEX IF NOT EXISTS idx_subscriptions_last_event_created_at
  ON public.subscriptions (user_id, last_event_created_at);
