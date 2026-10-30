-- Run after migrations 001–006 in the disposable database.
BEGIN;
SELECT no_plan();
-- Anonymous and ordinary clients cannot read admin_users.
SELECT is((SELECT count(*)::integer FROM public.admin_users), 0, 'anonymous cannot read admin users');
INSERT INTO auth.users (id, email) VALUES ('44444444-0000-4000-8000-000000000000', 'ordinary@example.invalid');
SET LOCAL ROLE authenticated;
SELECT throws_ok($$INSERT INTO public.admin_users (user_id, role) VALUES ('44444444-0000-4000-8000-000000000000','admin')$$, '42501', NULL, 'ordinary user cannot self-assign admin role');
SELECT * FROM finish();
ROLLBACK;