-- Run after migrations 001-006 in the disposable database.
BEGIN;
SELECT no_plan();

-- Anonymous and ordinary clients cannot read admin_users.
SET LOCAL ROLE anon;
SELECT throws_ok($$SELECT count(*) FROM public.admin_users$$, '42501', NULL, 'anonymous cannot read admin users');
RESET ROLE;

INSERT INTO auth.users (id, email) VALUES ('44444444-0000-4000-8000-000000000000', 'ordinary@example.invalid');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$INSERT INTO public.admin_users (user_id, role) VALUES ('44444444-0000-4000-8000-000000000000','admin')$$, '42501', NULL, 'ordinary user cannot self-assign admin role');
RESET ROLE;
SET LOCAL request.jwt.claim.role = 'authenticated';
SELECT throws_ok($$UPDATE public.profiles
  SET user_id = '55555555-0000-4000-8000-000000000000'
  WHERE user_id = '44444444-0000-4000-8000-000000000000'$$,
  'P0001', 'user_id is immutable',
  'authenticated profile updates cannot change user_id');
SELECT throws_ok($$UPDATE public.profiles
  SET created_at = created_at - interval '1 second'
  WHERE user_id = '44444444-0000-4000-8000-000000000000'$$,
  'P0001', 'created_at is immutable',
  'authenticated profile updates cannot change created_at');
SELECT throws_ok($$UPDATE public.profiles
  SET updated_at = updated_at - interval '1 second'
  WHERE user_id = '44444444-0000-4000-8000-000000000000'$$,
  'P0001', 'updated_at rollback is not allowed',
  'authenticated profile updates cannot move updated_at backwards');

SELECT * FROM finish();
ROLLBACK;
