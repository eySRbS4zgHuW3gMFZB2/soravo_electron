-- Run after bootstrap and migrations 001-008 in a disposable database.
BEGIN;
SELECT no_plan();

SET LOCAL ROLE anon;
SELECT throws_ok($$SELECT public.admin_dashboard_search_users('needle', 1, 25)$$, '42501', NULL, 'anon cannot invoke search');
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT public.admin_dashboard_search_users('needle', 1, 25)$$, '42501', NULL, 'authenticated cannot invoke search');
RESET ROLE;

INSERT INTO auth.users (id, email, created_at)
SELECT ('00000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'person-' || n || '@example.invalid', '2020-01-01'::timestamptz + n * interval '1 second'
FROM generate_series(1, 6007) AS n;

UPDATE auth.users SET email = 'Needle%_\Star*@example.invalid',
  email_confirmed_at = '2020-02-01'::timestamptz, banned_until = '2030-01-01'::timestamptz
WHERE id = '00000000-0000-0000-0000-000000006004';
UPDATE auth.users SET email = 'another-needle@example.invalid'
WHERE id = '00000000-0000-0000-0000-000000006007';
UPDATE public.profiles SET display_name = CASE
  WHEN user_id = '00000000-0000-0000-0000-000000006004' THEN 'Needle%_\Star*'
  ELSE 'NEEDLE name'
END WHERE user_id IN ('00000000-0000-0000-0000-000000006004', '00000000-0000-0000-0000-000000006005', '00000000-0000-0000-0000-000000006006');
DELETE FROM public.profiles WHERE user_id = '00000000-0000-0000-0000-000000006007';

SET LOCAL ROLE service_role;
SELECT is((public.admin_dashboard_search_users('NEEDLE', 1, 2)->>'total')::integer, 4, 'case-insensitive matches are deduplicated beyond 5000 users');
SELECT is(public.admin_dashboard_search_users('needle', 1, 2)->'users'->0->>'id', '00000000-0000-0000-0000-000000006004', 'email match comes first');
SELECT is(public.admin_dashboard_search_users('needle', 1, 2)->'users'->1->>'id', '00000000-0000-0000-0000-000000006007', 'email match without profile remains searchable');
SELECT is(public.admin_dashboard_search_users('needle', 2, 2)->'users'->0->>'id', '00000000-0000-0000-0000-000000006005', 'name-only matches follow email matches');
SELECT is(public.admin_dashboard_search_users('needle', 2, 2)->'users'->1->>'id', '00000000-0000-0000-0000-000000006006', 'name ties follow stable creation order');
SELECT is((public.admin_dashboard_search_users('needle', 3, 2)->>'total')::integer, 4, 'out-of-range page retains total');
SELECT is(jsonb_array_length(public.admin_dashboard_search_users('needle', 3, 2)->'users'), 0, 'out-of-range page is empty');
SELECT is((public.admin_dashboard_search_users('%_\Star*', 1, 25)->>'total')::integer, 1, 'wildcards, backslash and star match literally');
SELECT is((public.admin_dashboard_search_users('needle%_\StarX', 1, 25)->>'total')::integer, 0, 'literal metacharacters do not broaden matches');
SELECT is(jsonb_array_length(public.admin_dashboard_search_users('person-', 1, 100)->'users'), 50, 'page size is capped at 50');
SELECT is((public.admin_dashboard_search_users('', 1, 25)->>'total')::integer, 0, 'empty query does not enumerate accounts');
SELECT ok(public.admin_dashboard_search_users('needle', 1, 1)->'users'->0->>'email_confirmed_at' IS NOT NULL, 'confirmation timestamp is retained');
SELECT ok(public.admin_dashboard_search_users('needle', 1, 1)->'users'->0->>'banned_until' IS NOT NULL, 'ban timestamp is retained');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
