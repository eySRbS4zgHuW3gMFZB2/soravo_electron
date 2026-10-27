-- Additive billing/subscription metadata for genuine monthly recurring billing.
-- The initial migration retains an orders-first schema. This migration adds
-- the provider plan cache, provider subscription state, and supporting indexes
-- without rewriting migration history.

CREATE TABLE IF NOT EXISTS public.razorpay_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'razorpay',
  plan_code TEXT NOT NULL CHECK (plan_code = 'monthly'),
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  period TEXT NOT NULL DEFAULT 'monthly',
  interval INTEGER NOT NULL DEFAULT 1,
  provider_plan_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, plan_code, amount_minor, currency)
);

ALTER TABLE public.razorpay_plans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.razorpay_plans FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.razorpay_plans TO service_role;

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'razorpay',
  provider_subscription_id TEXT NOT NULL UNIQUE,
  plan_code TEXT NOT NULL CHECK (plan_code = 'monthly'),
  status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN ('created', 'authenticated', 'active', 'pending', 'halted', 'cancelled', 'paused', 'resumed', 'completed', 'expired', 'support_review')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  paid_count INTEGER NOT NULL DEFAULT 0,
  total_count INTEGER NOT NULL DEFAULT 0,
  charge_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own subscriptions" ON public.subscriptions;
CREATE POLICY "Users can read own subscriptions"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_provider_subscription_id
  ON public.subscriptions(provider, provider_subscription_id);

-- Ensure payment rows can be linked to recurring subscriptions.
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS provider_subscription_id TEXT;

CREATE INDEX IF NOT EXISTS idx_payments_provider_subscription_id
  ON public.payments(provider, provider_subscription_id);
