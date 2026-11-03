-- 013_email_outbox_producers_claim_and_retention.sql

-- Welcome email is queued in the same transaction as the authoritative
-- account-verification transition. No new account eligibility events are invented.
CREATE OR REPLACE FUNCTION public.queue_welcome_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS NOT NULL
     AND NEW.email <> ''
     AND NEW.email_confirmed_at IS NOT NULL THEN
    INSERT INTO public.email_outbox (
      user_id,
      recipient_email,
      template_key,
      idempotency_key,
      status,
      metadata
    )
    VALUES (
      NEW.id,
      NEW.email,
      'welcome',
      'welcome:auth-user:' || NEW.id::text,
      'pending',
      jsonb_build_object('displayName', COALESCE(NEW.raw_user_meta_data->>'display_name', 'there'))
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS email_outbox_welcome_on_insert ON auth.users;
CREATE TRIGGER email_outbox_welcome_on_insert
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.queue_welcome_email();

CREATE OR REPLACE FUNCTION public.queue_welcome_email_on_confirmation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL
     AND NEW.email IS NOT NULL AND NEW.email <> '' THEN
    INSERT INTO public.email_outbox (
      user_id,
      recipient_email,
      template_key,
      idempotency_key,
      status,
      metadata
    )
    VALUES (
      NEW.id,
      NEW.email,
      'welcome',
      'welcome:auth-user:' || NEW.id::text,
      'pending',
      jsonb_build_object('displayName', COALESCE(NEW.raw_user_meta_data->>'display_name', 'there'))
    )
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS email_outbox_welcome_on_confirmation ON auth.users;
CREATE TRIGGER email_outbox_welcome_on_confirmation
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW
WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.queue_welcome_email_on_confirmation();

-- Atomic claim for bounded email processing.
CREATE OR REPLACE FUNCTION public.claim_email_outbox_batch(
  p_batch_size integer,
  p_claim_token uuid,
  p_lease_seconds integer DEFAULT 60
)
RETURNS SETOF public.email_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_size integer := LEAST(GREATEST(COALESCE(p_batch_size, 25), 1), 100);
BEGIN
  -- A crashed worker may have consumed its final attempt without finalizing.
  -- Keep this limit in sync with MAX_EMAIL_ATTEMPTS in _shared/email-outbox.ts.
  UPDATE public.email_outbox
  SET status = 'failed_permanent',
      claim_token = NULL,
      claimed_at = NULL,
      lease_expires_at = NULL,
      next_attempt_at = NULL,
      last_error_code = 'attempts_exhausted',
      updated_at = now()
  WHERE status = 'processing'
    AND lease_expires_at < now()
    AND attempt_count >= 8;

  RETURN QUERY
  WITH next_rows AS (
    SELECT id
    FROM public.email_outbox
    WHERE attempt_count < 8
      AND (
        (status IN ('pending', 'failed_retryable')
          AND (next_attempt_at IS NULL OR next_attempt_at <= now())
          AND (lease_expires_at IS NULL OR lease_expires_at < now()))
        OR (status = 'processing' AND lease_expires_at < now())
      )
    ORDER BY created_at ASC
    LIMIT v_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.email_outbox e
  SET status = 'processing',
      claim_token = p_claim_token,
      claimed_at = now(),
      lease_expires_at = now() + (p_lease_seconds || ' seconds')::interval,
      attempt_count = e.attempt_count + 1,
      updated_at = now()
  FROM next_rows
  WHERE e.id = next_rows.id
  RETURNING e.*;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_email_outbox_batch(integer, uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_email_outbox_batch(integer, uuid, integer) TO service_role;

-- The defaults on the new signature preserve existing 11-argument calls.
-- Remove the old overload to avoid ambiguous PostgreSQL and PostgREST calls.
DROP FUNCTION IF EXISTS public.finalize_webhook_payment_atomic(TEXT, TEXT, UUID, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, TIMESTAMPTZ, BOOLEAN);

-- Replace finalize so verified captured payments enqueue downstream notifications in the same transaction.
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
  p_lifetime BOOLEAN,
  p_queue_payment_receipt BOOLEAN DEFAULT TRUE,
  p_queue_subscription_activated BOOLEAN DEFAULT FALSE,
  p_queue_subscription_renewed BOOLEAN DEFAULT FALSE
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
  v_existing_status TEXT;
  v_payment_already_captured BOOLEAN := FALSE;
  v_recipient_email TEXT;
  v_stored_period_end TIMESTAMPTZ;
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

  PERFORM pg_advisory_xact_lock(hashtext(p_provider || ':' || COALESCE(NULLIF(p_provider_order_id, ''), p_provider_payment_id)));
  PERFORM pg_advisory_xact_lock(hashtext(p_user_id::text || ':' || p_plan));

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

  SELECT user_id, amount_minor, currency, status
    INTO v_existing_user, v_existing_amount, v_existing_currency, v_existing_status
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
    v_payment_already_captured := (v_existing_status = 'captured');
  ELSE
    v_payment_already_captured := FALSE;
  END IF;

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

  SELECT user_id, amount_minor, currency, status
    INTO v_existing_user, v_existing_amount, v_existing_currency, v_existing_status
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
    IF NOT v_payment_already_captured THEN
      UPDATE public.payments
      SET status = 'captured',
          verified_at = now(),
          provider_order_id = COALESCE(NULLIF(p_provider_order_id, ''), provider_order_id)
      WHERE provider = p_provider
        AND provider_payment_id = p_provider_payment_id;
    END IF;
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

  IF NOT v_payment_already_captured THEN
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
      lifetime = EXCLUDED.lifetime
    RETURNING subscription_period_end INTO v_stored_period_end;

    SELECT email INTO v_recipient_email
    FROM auth.users
    WHERE id = p_user_id;

    IF v_recipient_email IS NOT NULL THEN
      IF p_queue_payment_receipt THEN
        INSERT INTO public.email_outbox (
          user_id, recipient_email, template_key, idempotency_key, status, metadata
        )
        VALUES (
          p_user_id,
          v_recipient_email,
          'payment_receipt',
          'payment_receipt:razorpay:' || p_provider_payment_id,
          'pending',
          jsonb_build_object(
            'plan', p_plan,
            'amountDisplay', to_char(p_amount_minor::numeric / 100, 'FM9999999990.00'),
            'currency', p_currency,
            'paymentReference', p_provider_payment_id,
            'date', now()::text
          )
        )
        ON CONFLICT (idempotency_key) DO NOTHING;
      END IF;
      IF p_queue_subscription_activated THEN
        INSERT INTO public.email_outbox (
          user_id, recipient_email, template_key, idempotency_key, status, metadata
        )
        VALUES (
          p_user_id,
          v_recipient_email,
          'subscription_activated',
          'subscription_activated:razorpay:' || p_provider_payment_id,
          'pending',
          jsonb_build_object('plan', p_plan)
        )
        ON CONFLICT (idempotency_key) DO NOTHING;
      END IF;
      IF p_queue_subscription_renewed THEN
        INSERT INTO public.email_outbox (
          user_id, recipient_email, template_key, idempotency_key, status, metadata
        )
        VALUES (
          p_user_id,
          v_recipient_email,
          'subscription_renewed',
          'subscription_renewed:razorpay:' || p_provider_payment_id,
          'pending',
          jsonb_build_object('plan', p_plan, 'periodEnd', v_stored_period_end::text)
        )
        ON CONFLICT (idempotency_key) DO NOTHING;
      END IF;
    END IF;
  END IF;

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

REVOKE EXECUTE ON FUNCTION public.finalize_webhook_payment_atomic(TEXT, TEXT, UUID, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, TIMESTAMPTZ, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_webhook_payment_atomic(TEXT, TEXT, UUID, UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, TIMESTAMPTZ, BOOLEAN, BOOLEAN, BOOLEAN, BOOLEAN) TO service_role;

-- Retention cleanup: redact recipient and PII after the configured period.
CREATE OR REPLACE FUNCTION public.cleanup_email_outboxRetention(
  p_retention_days integer DEFAULT 90
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.email_outbox
  SET status = CASE
        WHEN status IN ('pending', 'processing', 'failed_retryable') THEN 'failed_permanent'
        ELSE status
      END,
      next_attempt_at = NULL,
      last_error_code = COALESCE(last_error_code, 'retention_redacted'),
      recipient_email = '[redacted]',
      metadata = '{}'::jsonb,
      updated_at = now()
  WHERE created_at < now() - (p_retention_days || ' days')::interval
    AND recipient_email <> '[redacted]';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Fix accidental function name at runtime migration time? Keep expected name below.
CREATE OR REPLACE FUNCTION public.cleanup_email_outbox_retention(
  p_retention_days integer DEFAULT 90
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.email_outbox
  SET status = CASE
        WHEN status IN ('pending', 'processing', 'failed_retryable') THEN 'failed_permanent'
        ELSE status
      END,
      next_attempt_at = NULL,
      last_error_code = COALESCE(last_error_code, 'retention_redacted'),
      recipient_email = '[redacted]',
      metadata = '{}'::jsonb,
      updated_at = now()
  WHERE created_at < now() - (p_retention_days || ' days')::interval
    AND recipient_email <> '[redacted]';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_email_outbox_retention(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_email_outbox_retention(integer) TO service_role;

DROP FUNCTION IF EXISTS public.cleanup_email_outboxRetention(integer);

CREATE OR REPLACE FUNCTION public.redact_email_outbox_on_user_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.email_outbox
  SET recipient_email = '[redacted]',
      metadata = '{}'::jsonb,
      status = CASE
        WHEN status IN ('pending', 'processing', 'failed_retryable') THEN 'failed_permanent'
        ELSE status
      END,
      next_attempt_at = NULL,
      last_error_code = COALESCE(last_error_code, 'user_deleted')
  WHERE user_id = OLD.id
    AND recipient_email <> '[redacted]';
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS email_outbox_redact_on_user_delete ON auth.users;
CREATE TRIGGER email_outbox_redact_on_user_delete
BEFORE DELETE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.redact_email_outbox_on_user_delete();
