-- Upgrade databases that applied the original 006 migration. Find the actual
-- single-column FK, including deployments where it was renamed.
DO $$
DECLARE
  fk_name text;
  matched boolean := false;
BEGIN
  FOR fk_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attname = 'granted_by'
    JOIN pg_attribute target ON target.attrelid = c.confrelid AND target.attname = 'id'
    WHERE c.conrelid = 'public.admin_users'::regclass
      AND c.confrelid = 'auth.users'::regclass
      AND c.contype = 'f'
      AND c.conkey = ARRAY[a.attnum]::smallint[]
      AND c.confkey = ARRAY[target.attnum]::smallint[]
  LOOP
    EXECUTE format('ALTER TABLE public.admin_users DROP CONSTRAINT %I', fk_name);
    matched := true;
  END LOOP;
  IF NOT matched THEN
    RAISE EXCEPTION 'Expected admin_users.granted_by foreign key was not found';
  END IF;
END;
$$;

ALTER TABLE public.admin_users
  ADD CONSTRAINT admin_users_granted_by_fkey
  FOREIGN KEY (granted_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Match the guards in 006, but read the role from PostgREST's claims object.
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role') = 'authenticated'
     AND (NEW IS DISTINCT FROM OLD) THEN
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
