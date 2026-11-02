-- Exercise an existing installation with the original 006 behavior, including
-- a renamed FK, then apply the follow-up migration transactionally.
BEGIN;
SELECT no_plan();

ALTER TABLE public.admin_users DROP CONSTRAINT admin_users_granted_by_fkey;
ALTER TABLE public.admin_users ADD CONSTRAINT historical_grantor_fk
  FOREIGN KEY (granted_by) REFERENCES auth.users(id);
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'authenticated' AND NEW IS DISTINCT FROM OLD THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN RAISE EXCEPTION 'user_id is immutable'; END IF;
    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN RAISE EXCEPTION 'created_at is immutable'; END IF;
    IF NEW.updated_at < OLD.updated_at THEN RAISE EXCEPTION 'updated_at rollback is not allowed'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
\ir ../migrations/011_admin_role_upgrade.sql

-- Replace the test bootstrap's NULL-only auth.uid with a claims-based fixture.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
INSERT INTO auth.users (id,email) VALUES
  ('77777777-0000-4000-8000-000000000001','grantor@example.invalid'),
  ('77777777-0000-4000-8000-000000000002','admin@example.invalid'),
  ('77777777-0000-4000-8000-000000000003','other@example.invalid');
INSERT INTO public.admin_users (user_id,role,granted_by)
  VALUES ('77777777-0000-4000-8000-000000000002','admin','77777777-0000-4000-8000-000000000001');
DELETE FROM auth.users WHERE id = '77777777-0000-4000-8000-000000000001';
SELECT is((SELECT granted_by FROM public.admin_users WHERE user_id = '77777777-0000-4000-8000-000000000002'), NULL::uuid, 'deleting grantor clears attribution');
SELECT is((SELECT confdeltype::text FROM pg_constraint WHERE conrelid='public.admin_users'::regclass AND conname='admin_users_granted_by_fkey'), 'n', 'upgraded foreign key uses SET NULL');

SET LOCAL request.jwt.claims = '{"role":"authenticated","sub":"77777777-0000-4000-8000-000000000002"}';
SET LOCAL ROLE authenticated;
SELECT throws_ok($$UPDATE public.profiles SET user_id='77777777-0000-4000-8000-000000000003' WHERE user_id='77777777-0000-4000-8000-000000000002'$$, 'P0001', 'user_id is immutable', 'claims role guards user_id');
SELECT throws_ok($$UPDATE public.profiles SET created_at=created_at - interval '1 second' WHERE user_id='77777777-0000-4000-8000-000000000002'$$, 'P0001', 'created_at is immutable', 'claims role guards created_at');
SELECT throws_ok($$UPDATE public.profiles SET updated_at=updated_at - interval '1 second' WHERE user_id='77777777-0000-4000-8000-000000000002'$$, 'P0001', 'updated_at rollback is not allowed', 'claims role guards updated_at');
SELECT lives_ok($$UPDATE public.profiles SET display_name='Updated' WHERE user_id='77777777-0000-4000-8000-000000000002'$$, 'authenticated user can edit own display name');
SELECT is((SELECT display_name FROM public.profiles WHERE user_id='77777777-0000-4000-8000-000000000002'), 'Updated', 'permitted profile edit persisted');
SELECT throws_ok($$SELECT * FROM public.admin_users$$, '42501', NULL, 'admin table remains inaccessible to authenticated user');
RESET ROLE;
GRANT SELECT, UPDATE ON public.profiles TO service_role;
SET LOCAL request.jwt.claims = '{"role":"service_role"}';
SET LOCAL ROLE service_role;
SELECT lives_ok($$UPDATE public.profiles SET created_at=created_at - interval '1 second' WHERE user_id='77777777-0000-4000-8000-000000000002'$$, 'service role can perform privileged profile update');
RESET ROLE;
DELETE FROM auth.users WHERE id='77777777-0000-4000-8000-000000000002';
SELECT is((SELECT count(*) FROM public.admin_users WHERE user_id='77777777-0000-4000-8000-000000000002'), 0::bigint, 'deleting admin still cascades');
SELECT * FROM finish();
ROLLBACK;
