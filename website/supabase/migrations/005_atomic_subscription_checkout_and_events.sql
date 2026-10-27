-- Reserve a user's checkout before contacting Razorpay. Reservations do not
-- expire: a timeout/crash may hide a successful provider create. Reconcile that
-- outcome before releasing a reservation rather than risk a duplicate charge.
CREATE TABLE public.monthly_checkout_reservations (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.monthly_checkout_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.monthly_checkout_reservations FROM anon, authenticated;
GRANT SELECT, DELETE ON public.monthly_checkout_reservations TO service_role;

CREATE FUNCTION public.claim_monthly_checkout(p_user_id UUID, p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription public.subscriptions%ROWTYPE;
BEGIN
  -- This lock serializes the check-and-reserve transaction for each user.
  PERFORM 1 FROM auth.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown user'; END IF;

  IF EXISTS (SELECT 1 FROM public.entitlements WHERE user_id = p_user_id
    AND plan_code = 'lifetime' AND (lifetime OR status = 'lifetime_active')) THEN
    RETURN jsonb_build_object('status', 'blocked', 'error', 'Lifetime entitlement already active');
  END IF;
  IF EXISTS (SELECT 1 FROM public.entitlements WHERE user_id = p_user_id
    AND plan_code = 'monthly' AND status IN ('active', 'payment_pending')) THEN
    RETURN jsonb_build_object('status', 'blocked', 'error', 'Monthly subscription already active');
  END IF;

  SELECT * INTO v_subscription FROM public.subscriptions
  WHERE user_id = p_user_id AND provider = 'razorpay' AND plan_code = 'monthly'
    AND status IN ('created', 'authenticated', 'active', 'pending', 'resumed');
  IF FOUND THEN
    IF v_subscription.status <> 'created' THEN
      RETURN jsonb_build_object('status', 'blocked', 'error', 'Monthly subscription already active');
    END IF;
    RETURN jsonb_build_object('status', 'reuse', 'subscription_id', v_subscription.provider_subscription_id);
  END IF;

  INSERT INTO public.monthly_checkout_reservations (user_id, request_id)
  VALUES (p_user_id, p_request_id) ON CONFLICT (user_id) DO NOTHING;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'busy', 'error', 'Monthly subscription checkout is already being created');
  END IF;
  RETURN jsonb_build_object('status', 'claimed');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.claim_monthly_checkout(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_monthly_checkout(UUID, UUID) TO service_role;

-- Both lifecycle events and captured-payment metadata use this conditional
-- upsert. PostgreSQL checks the timestamp against the locked conflicting row,
-- so concurrently delivered events cannot bypass ordering with a stale read.
CREATE FUNCTION public.apply_subscription_event(
  p_provider_subscription_id TEXT,
  p_status TEXT,
  p_event_created_at TIMESTAMPTZ,
  p_user_id UUID,
  p_period_end TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := p_user_id;
  v_rows INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    -- Resolve events without notes from a subscription already recorded locally.
    SELECT user_id INTO v_user_id FROM public.subscriptions
    WHERE provider = 'razorpay' AND provider_subscription_id = p_provider_subscription_id;
    IF NOT FOUND THEN RETURN FALSE; END IF;
  END IF;

  INSERT INTO public.subscriptions AS current (
    user_id, provider, provider_subscription_id, plan_code,
    status, current_period_end, last_event_created_at
  ) VALUES (
    v_user_id, 'razorpay', p_provider_subscription_id, 'monthly',
    p_status, p_period_end, p_event_created_at
  )
  ON CONFLICT (provider_subscription_id) DO UPDATE SET
    status = EXCLUDED.status,
    current_period_end = CASE
      WHEN EXCLUDED.last_event_created_at = current.last_event_created_at
        THEN GREATEST(EXCLUDED.current_period_end, current.current_period_end)
      ELSE COALESCE(EXCLUDED.current_period_end, current.current_period_end)
    END,
    last_event_created_at = EXCLUDED.last_event_created_at,
    updated_at = now()
  WHERE current.user_id = EXCLUDED.user_id AND current.provider = 'razorpay'
    AND (
      (current.last_event_created_at IS NULL AND EXCLUDED.last_event_created_at IS NOT NULL
        AND (current.status NOT IN ('cancelled', 'completed', 'expired')
          OR EXCLUDED.status IN ('cancelled', 'completed', 'expired')))
      OR EXCLUDED.last_event_created_at > current.last_event_created_at
      -- An undated terminal event may close a new undated checkout. Without an
      -- ordering timestamp its terminal state cannot safely be reactivated.
      OR (current.last_event_created_at IS NULL AND EXCLUDED.last_event_created_at IS NULL
        AND EXCLUDED.status IN ('cancelled', 'completed', 'expired')
        AND current.status NOT IN ('cancelled', 'completed', 'expired'))
      -- Same-state events may enrich metadata without regressing the paid period.
      OR (EXCLUDED.last_event_created_at = current.last_event_created_at
        AND EXCLUDED.status = current.status)
      -- Provider timestamps have second precision. Terminal state wins ties;
      -- undated events cannot overwrite dated state.
      OR (EXCLUDED.last_event_created_at = current.last_event_created_at
        AND EXCLUDED.status IN ('cancelled', 'completed', 'expired')
        AND current.status NOT IN ('cancelled', 'completed', 'expired'))
    );
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 AND p_status = 'active' AND p_period_end IS NOT NULL THEN
    -- A verified late capture may extend its paid period without reactivating a
    -- newer cancellation or changing the lifecycle watermark. The conflicting
    -- row remains locked by the upsert for this transaction.
    UPDATE public.subscriptions
    SET current_period_end = p_period_end
    WHERE provider = 'razorpay' AND provider_subscription_id = p_provider_subscription_id
      AND user_id = v_user_id
      AND (current_period_end IS NULL OR current_period_end < p_period_end);
  END IF;
  RETURN v_rows > 0;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.apply_subscription_event(TEXT, TEXT, TIMESTAMPTZ, UUID, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_subscription_event(TEXT, TEXT, TIMESTAMPTZ, UUID, TIMESTAMPTZ) TO service_role;
