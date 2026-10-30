-- Reserve lifetime checkout before contacting Razorpay. Uncertain outcomes
-- require provider reconciliation before releasing the reservation.
CREATE TABLE public.lifetime_checkout_reservations (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lifetime_checkout_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lifetime_checkout_reservations FROM anon, authenticated;
GRANT SELECT, DELETE ON public.lifetime_checkout_reservations TO service_role;

CREATE FUNCTION public.claim_lifetime_checkout(p_user_id UUID, p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));
  PERFORM 1 FROM auth.users WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown user'; END IF;

  -- Match the payment finalizer's lock so a captured order cannot disappear
  -- from the unpaid lookup before its entitlement becomes visible.
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text || ':lifetime'));
  IF EXISTS (SELECT 1 FROM public.entitlements WHERE user_id = p_user_id
    AND plan_code = 'lifetime' AND status IN ('lifetime_active', 'active')) THEN
    RETURN jsonb_build_object('status', 'blocked', 'error', 'Lifetime entitlement already active');
  END IF;

  -- Reuse the server-created order placeholder after a successful save. A
  -- failed payment attempt does not consume its order; a verified capture does.
  SELECT payment.provider_order_id INTO v_order_id
  FROM public.payments AS payment
  WHERE payment.user_id = p_user_id AND payment.provider = 'razorpay'
    AND payment.provider_subscription_id IS NULL
    AND payment.provider_payment_id = payment.provider_order_id
    AND payment.amount_minor = 5000 AND payment.currency = 'USD'
    AND payment.status IN ('pending', 'failed')
    AND NOT EXISTS (
      SELECT 1 FROM public.payments AS settled
      WHERE settled.provider = payment.provider
        AND settled.provider_order_id = payment.provider_order_id
        AND settled.status IN ('captured', 'refunded', 'chargeback')
    )
  ORDER BY payment.created_at, payment.id
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('status', 'reuse', 'order_id', v_order_id);
  END IF;

  INSERT INTO public.lifetime_checkout_reservations (user_id, request_id)
  VALUES (p_user_id, p_request_id) ON CONFLICT (user_id) DO NOTHING;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'busy', 'error', 'Lifetime checkout is already being created');
  END IF;
  RETURN jsonb_build_object('status', 'claimed');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.claim_lifetime_checkout(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_lifetime_checkout(UUID, UUID) TO service_role;
