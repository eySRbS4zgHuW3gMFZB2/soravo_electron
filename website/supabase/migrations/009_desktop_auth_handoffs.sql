BEGIN;

CREATE TABLE IF NOT EXISTS public.desktop_auth_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash text NOT NULL UNIQUE,
  code_challenge text NOT NULL,
  state text NOT NULL,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.desktop_auth_handoffs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.desktop_auth_handoffs FROM anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.desktop_auth_handoffs TO service_role;

CREATE INDEX IF NOT EXISTS idx_desktop_auth_handoffs_expires_at
  ON public.desktop_auth_handoffs (expires_at);

COMMIT;
