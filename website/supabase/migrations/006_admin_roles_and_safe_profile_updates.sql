-- Admin authorization roles.
--
-- The browser/RLS layer is intentionally NOT the authorization source for
-- administrative access. This table is service-role only: ordinary users have
-- no grant, no policy, and no way to insert or revoke their own row.

CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin')),
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  CHECK (granted_by IS NULL OR granted_by <> user_id)
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_users FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_users TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- An active admin is one with a non-null row and a null revoked_at timestamp.
-- The column list is fixed so the Edge Function can query it directly.
CREATE INDEX IF NOT EXISTS idx_admin_users_active
  ON public.admin_users (user_id)
  WHERE revoked_at IS NULL;

-- Prevent self-assignment of admin privileges through profile updates.
-- The admin role is never stored in profiles, but this trigger blocks attempts
-- to create or alter any sensitive directory fields through the profile path.
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'authenticated'
     AND (NEW IS DISTINCT FROM OLD) THEN
    -- Only display_name and updated_at are user-editable.
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'user_id is immutable';
    END IF;
    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'created_at is immutable';
    END IF;
    IF NEW.updated_at < OLD.updated_at THEN
      RAISE EXCEPTION 'updated_at rollback is not allowed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_profile_sensitive_fields ON public.profiles;
CREATE TRIGGER protect_profile_sensitive_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_sensitive_fields();

-- Allow admin operations to be audited even before an accessor exists.
CREATE INDEX IF NOT EXISTS idx_admin_audit_events_actor
  ON public.admin_audit_events (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_events_created_at
  ON public.admin_audit_events (created_at DESC);