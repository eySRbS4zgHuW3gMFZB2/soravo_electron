-- Soravo initial schema
-- Profiles, devices, entitlements, payments, webhook events, admin audit events
-- All tables have RLS enabled. Service-role operations happen server-side only.

-- Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Devices
CREATE TABLE IF NOT EXISTS public.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  label TEXT,
  platform TEXT,
  app_version TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  UNIQUE (user_id, device_id)
);

ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own devices"
  ON public.devices FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT policy or grant for clients: device registration must go through
-- the server-side register_device_atomic function (service-role), which enforces
-- the entitlement check and the device limit.

-- Users may update only the revocation state of their own devices.
-- Column-level privileges (below) restrict the updateable columns to revoked_at.
-- WITH CHECK requires revoked_at to be set (non-null), so clients cannot
-- reactivate a device by clearing revoked_at.
CREATE POLICY "Users can update own devices"
  ON public.devices FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND revoked_at IS NOT NULL);

-- Clients may modify only revoked_at; device_id and ownership are immutable client-side.
REVOKE ALL ON public.devices FROM anon, authenticated;
GRANT SELECT (id, user_id, device_id, label, platform, app_version, first_seen_at, last_seen_at, revoked_at) ON public.devices TO authenticated;
GRANT UPDATE (revoked_at) ON public.devices TO authenticated;

-- Service-role only: device registration, revocation, heartbeat updates
-- Registration and reactivation are routed through the register_device_atomic
-- function (SECURITY DEFINER), which is grantable to service_role only.

-- Entitlements
CREATE TABLE IF NOT EXISTS public.entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_code TEXT NOT NULL CHECK (plan_code IN ('monthly', 'lifetime')),
  status TEXT NOT NULL CHECK (status IN ('unactivated', 'active', 'grace', 'expired', 'payment_pending', 'payment_failed', 'revoked', 'lifetime_active', 'support_review')),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_verified_at TIMESTAMPTZ,
  subscription_period_end TIMESTAMPTZ,
  lifetime BOOLEAN NOT NULL DEFAULT false,
  metadata_version INTEGER NOT NULL DEFAULT 1,
  UNIQUE (user_id, plan_code)
);

ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own entitlements"
  ON public.entitlements FOR SELECT
  USING (auth.uid() = user_id);

-- Payments
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'razorpay',
  provider_payment_id TEXT NOT NULL,
  provider_order_id TEXT,
  provider_subscription_id TEXT,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL CHECK (status IN ('pending', 'captured', 'failed', 'refunded', 'chargeback')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at TIMESTAMPTZ,
  refund_state TEXT,
  UNIQUE (provider, provider_payment_id)
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own payments"
  ON public.payments FOR SELECT
  USING (auth.uid() = user_id);

-- Webhook events (idempotency ledger)
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'razorpay',
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  signature_valid BOOLEAN NOT NULL DEFAULT false,
  processing_status TEXT NOT NULL CHECK (processing_status IN ('received', 'processing', 'processed', 'failed', 'duplicate', 'support_review')),
  claimed_at TIMESTAMPTZ,
  lease_expires_at TIMESTAMPTZ,
  claim_token UUID DEFAULT gen_random_uuid(),
  retry_count INTEGER NOT NULL DEFAULT 0,
  processed_at TIMESTAMPTZ,
  error_code TEXT,
  UNIQUE (provider, provider_event_id)
);

-- Webhook events are server-side only: RLS enabled with no client policies,
-- and anon/authenticated privileges are revoked so only service-role access
-- (or a SECURITY DEFINER function) can read or modify them.
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.webhook_events FROM anon, authenticated;
GRANT SELECT ON public.webhook_events TO service_role;
GRANT INSERT ON public.webhook_events TO service_role;
GRANT UPDATE (processing_status, claim_token, claimed_at, lease_expires_at, retry_count, processed_at, error_code) ON public.webhook_events TO service_role;

-- Admin audit events
CREATE TABLE IF NOT EXISTS public.admin_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Admin audit events are server-side only: RLS enabled with no client policies,
-- and anon/authenticated privileges are revoked.
ALTER TABLE public.admin_audit_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.admin_audit_events FROM anon, authenticated;
GRANT SELECT ON public.admin_audit_events TO service_role;
GRANT INSERT ON public.admin_audit_events TO service_role;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'display_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON public.devices(user_id);
CREATE INDEX IF NOT EXISTS idx_entitlements_user_id ON public.entitlements(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_event ON public.webhook_events(provider, provider_event_id);
-- Atomic device registration function (prevents race conditions)
-- Returns: { success: boolean, device_count: integer, limit_reached: boolean, error: text }
--
-- Correctness notes:
-- 1. A per-user advisory transaction lock serializes concurrent registrations for
--    the same user, making the count-then-write sequence race-free.
-- 2. The monthly limit applies to NEW devices. An ALREADY-ACTIVE device may be
--    refreshed at the limit, but a REVOKED device must pass the limit check again
--    before it can be reactivated (otherwise users could exceed 3 active devices
--    by cycling revoked devices in and out).
-- 3. This function is SECURITY DEFINER and must only be callable by the
--    service-role (see REVOKE/GRANT below). It does not trust p_user_id from
--    clients; the Edge Function derives p_user_id from the validated JWT.
CREATE OR REPLACE FUNCTION public.register_device_atomic(
  p_user_id UUID,
  p_device_id TEXT,
  p_label TEXT DEFAULT NULL,
  p_platform TEXT DEFAULT NULL,
  p_app_version TEXT DEFAULT NULL,
  p_is_lifetime BOOLEAN DEFAULT FALSE
)
RETURNS JSONB AS $$
DECLARE
  v_device_count INTEGER;
  v_is_active BOOLEAN;
BEGIN
  -- Serialize per user to avoid race conditions on the limit check.
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text));

  -- Is this device currently ACTIVE for the user? Revoked devices must pass
  -- the limit check like new devices.
  SELECT EXISTS (
    SELECT 1 FROM public.devices
    WHERE user_id = p_user_id AND device_id = p_device_id AND revoked_at IS NULL
  ) INTO v_is_active;

  -- Apply the monthly limit (max 3 active devices) only to NEW or revoked devices.
  IF NOT p_is_lifetime AND NOT v_is_active THEN
    SELECT COUNT(*) INTO v_device_count
    FROM public.devices
    WHERE user_id = p_user_id AND revoked_at IS NULL;

    IF v_device_count >= 3 THEN
      RETURN jsonb_build_object(
        'success', false,
        'device_count', v_device_count,
        'limit_reached', true,
        'error', 'Device limit reached (max 3 for monthly plan)'
      );
    END IF;
  END IF;

  -- Upsert device (idempotent: re-registering same active device is safe).
  -- Reactivation clears revoked_at so the device rejoins the active set.
  INSERT INTO public.devices (user_id, device_id, label, platform, app_version, last_seen_at)
  VALUES (p_user_id, p_device_id, p_label, p_platform, p_app_version, now())
  ON CONFLICT (user_id, device_id) DO UPDATE SET
    label = COALESCE(EXCLUDED.label, devices.label),
    platform = COALESCE(EXCLUDED.platform, devices.platform),
    app_version = COALESCE(EXCLUDED.app_version, devices.app_version),
    last_seen_at = now(),
    revoked_at = NULL;

  -- Get updated count
  SELECT COUNT(*) INTO v_device_count
  FROM public.devices
  WHERE user_id = p_user_id AND revoked_at IS NULL;

  RETURN jsonb_build_object(
    'success', true,
    'device_count', v_device_count,
    'limit_reached', false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Only the service-role may invoke register_device_atomic. PostgreSQL grants
-- default EXECUTE to PUBLIC on new functions, so revoke it first; otherwise any
-- anon/authenticated client could call the SECURITY DEFINER function with an
-- arbitrary user id and bypass the entitlement and device-limit checks.
REVOKE EXECUTE ON FUNCTION public.register_device_atomic(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_device_atomic(UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO service_role;

-- Atomic webhook provisioning: validates the current claim token and processing
-- status, then promotes/records the payment, upserts the entitlement, and
-- finalizes the webhook event in one transaction. A stale token returns 0 and
-- performs no business writes. SECURITY DEFINER, service-role only.
CREATE OR REPLACE FUNCTION public.finalize_webhook_payment_atomic(
  p_provider TEXT,
  p_provider_event_id TEXT,
  p_claim_token UUID,
  p_user_id UUID,
  p_plan TEXT,
  p_provider_payment_id TEXT,
  p_provider_order_id TEXT,
  p_amount_minor INTEGER,
  p_currency TEXT,
  p_period_end TIMESTAMPTZ,
  p_lifetime BOOLEAN
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows INTEGER;
  v_existing_user UUID;
  v_existing_amount INTEGER;
  v_existing_currency TEXT;
BEGIN
  IF p_provider IS NULL OR p_provider = '' THEN
    RAISE EXCEPTION 'invalid provider';
  END IF;
  IF p_provider_event_id IS NULL OR p_provider_event_id = '' THEN
    RAISE EXCEPTION 'invalid provider_event_id';
  END IF;
  IF p_claim_token IS NULL THEN
    RAISE EXCEPTION 'invalid claim_token';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid user_id';
  END IF;
  IF p_plan IS NULL OR p_plan NOT IN ('monthly', 'lifetime') THEN
    RAISE EXCEPTION 'invalid plan';
  END IF;
  IF p_provider_payment_id IS NULL OR p_provider_payment_id = '' THEN
    RAISE EXCEPTION 'invalid provider_payment_id';
  END IF;
  IF p_amount_minor IS NULL OR p_amount_minor <= 0 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;
  IF p_currency IS NULL OR p_currency <> 'USD' THEN
    RAISE EXCEPTION 'invalid currency';
  END IF;
  IF p_lifetime IS NULL OR p_lifetime <> (p_plan = 'lifetime') THEN
    RAISE EXCEPTION 'invalid lifetime flag';
  END IF;
  IF p_plan = 'monthly' AND (p_period_end IS NULL OR p_period_end <= now()) THEN
    RAISE EXCEPTION 'invalid period end';
  END IF;
  IF p_plan = 'lifetime' AND p_period_end IS NOT NULL THEN
    RAISE EXCEPTION 'invalid period end';
  END IF;
  IF p_plan = 'monthly' AND p_amount_minor <> 1200 THEN
    RAISE EXCEPTION 'amount does not match plan';
  END IF;
  IF p_plan = 'lifetime' AND p_amount_minor <> 5000 THEN
    RAISE EXCEPTION 'amount does not match plan';
  END IF;

  -- Atomically verify ownership of the claim. Lock the event row.
  PERFORM 1
  FROM public.webhook_events
  WHERE provider = p_provider
    AND provider_event_id = p_provider_event_id
    AND claim_token = p_claim_token
    AND processing_status = 'processing'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Bind promotion to the server-created pending record. A mismatched pending
  -- row must abort the transaction rather than be promoted or overwritten.
  IF p_provider_order_id IS NOT NULL AND p_provider_order_id <> '' THEN
    IF EXISTS (
      SELECT 1 FROM public.payments
      WHERE provider = p_provider
        AND provider_order_id = p_provider_order_id
        AND status = 'pending'
        AND (user_id <> p_user_id OR amount_minor <> p_amount_minor OR currency <> p_currency)
    ) THEN
      RAISE EXCEPTION 'pending payment binding mismatch';
    END IF;

    UPDATE public.payments
    SET provider_payment_id = p_provider_payment_id,
        status = 'captured',
        verified_at = now()
    WHERE provider = p_provider
      AND provider_order_id = p_provider_order_id
      AND status = 'pending'
      AND user_id = p_user_id
      AND amount_minor = p_amount_minor
      AND currency = p_currency;
  END IF;

  -- Record the captured payment. Immutable identity fields are never
  -- overwritten on conflict; a conflicting existing row aborts instead.
    SELECT user_id, amount_minor, currency
      INTO v_existing_user, v_existing_amount, v_existing_currency
    FROM public.payments
    WHERE provider = p_provider
      AND provider_payment_id = p_provider_payment_id
    FOR UPDATE;

    IF FOUND THEN
      IF v_existing_user <> p_user_id
         OR v_existing_amount <> p_amount_minor
         OR v_existing_currency <> p_currency THEN
        RAISE EXCEPTION 'payment identity conflict';
      END IF;
      UPDATE public.payments
      SET status = 'captured',
          verified_at = now(),
          provider_order_id = COALESCE(NULLIF(p_provider_order_id, ''), provider_order_id)
      WHERE provider = p_provider
        AND provider_payment_id = p_provider_payment_id;
    ELSE
      INSERT INTO public.payments (
        user_id, provider, provider_payment_id, provider_order_id,
        amount_minor, currency, status, verified_at
      )
      VALUES (
        p_user_id, p_provider, p_provider_payment_id,
        NULLIF(p_provider_order_id, ''), p_amount_minor, p_currency, 'captured', now()
      );
    END IF;

  -- Upsert entitlement.
  INSERT INTO public.entitlements (
    user_id, plan_code, status, issued_at, last_verified_at,
    subscription_period_end, lifetime
  )
  VALUES (
    p_user_id, p_plan,
    CASE WHEN p_plan = 'lifetime' THEN 'lifetime_active' ELSE 'active' END,
    now(), now(), p_period_end, p_lifetime
  )
  ON CONFLICT (user_id, plan_code) DO UPDATE SET
    status = EXCLUDED.status,
    issued_at = EXCLUDED.issued_at,
    last_verified_at = EXCLUDED.last_verified_at,
    subscription_period_end = CASE
      WHEN EXCLUDED.lifetime THEN NULL
      WHEN entitlements.subscription_period_end IS NOT NULL
       AND entitlements.subscription_period_end > now()
        THEN entitlements.subscription_period_end + INTERVAL '30 days'
      ELSE EXCLUDED.subscription_period_end
    END,
    lifetime = EXCLUDED.lifetime;

  -- Finalize the event only while ownership still holds.
  UPDATE public.webhook_events
  SET processing_status = 'processed',
      processed_at = now()
  WHERE provider = p_provider
    AND provider_event_id = p_provider_event_id
    AND claim_token = p_claim_token
    AND processing_status = 'processing';

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'lost claim during finalization';
  END IF;

  RETURN v_rows;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.finalize_webhook_payment_atomic(TEXT, TEXT, UUID, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, TIMESTAMPTZ, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_webhook_payment_atomic(TEXT, TEXT, UUID, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, TIMESTAMPTZ, BOOLEAN) TO service_role;

-- Compatibility alias without the _atomic suffix.
CREATE OR REPLACE FUNCTION public.finalize_webhook_payment(
  p_provider TEXT,
  p_provider_event_id TEXT,
  p_claim_token UUID,
  p_user_id UUID,
  p_plan TEXT,
  p_provider_payment_id TEXT,
  p_provider_order_id TEXT,
  p_amount_minor INTEGER,
  p_currency TEXT,
  p_period_end TIMESTAMPTZ,
  p_lifetime BOOLEAN
)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.finalize_webhook_payment_atomic(
    p_provider, p_provider_event_id, p_claim_token, p_user_id, p_plan,
    p_provider_payment_id, p_provider_order_id, p_amount_minor, p_currency,
    p_period_end, p_lifetime
  );
$$;

REVOKE EXECUTE ON FUNCTION public.finalize_webhook_payment(TEXT, TEXT, UUID, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, TIMESTAMPTZ, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_webhook_payment(TEXT, TEXT, UUID, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, TIMESTAMPTZ, BOOLEAN) TO service_role;
