-- 012_email_outbox_and_resend_delivery.sql
-- Soravo transactional email outbox and Resend delivery monitoring state.
-- Server-only. No client roles have access to these rows.

CREATE TABLE IF NOT EXISTS public.email_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  template_key TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','processing','sent','failed_retryable','failed_permanent')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ,
  delivery_status TEXT CHECK (delivery_status IS NULL OR delivery_status IN ('sent','delivered','delayed','bounced','complained','failed','suppressed')),
  delivery_updated_at TIMESTAMPTZ,
  provider_message_id TEXT,
  claim_token UUID DEFAULT gen_random_uuid(),
  claimed_at TIMESTAMPTZ,
  lease_expires_at TIMESTAMPTZ,
  last_error_code TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_email_outbox_status_next_attempt
  ON public.email_outbox(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_email_outbox_provider_message_id
  ON public.email_outbox(provider_message_id);
CREATE INDEX IF NOT EXISTS idx_email_outbox_user_id
  ON public.email_outbox(user_id);

ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_outbox FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.email_outbox TO service_role;
