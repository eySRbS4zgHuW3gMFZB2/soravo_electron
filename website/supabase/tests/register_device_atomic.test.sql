-- Database-backed contract tests for public.register_device_atomic
--
-- Prerequisites (run where a Postgres/Supabase test database is available):
--   1. Apply website/supabase/migrations/001_initial_schema.sql
--   2. CREATE EXTENSION IF NOT EXISTS pgtap;
--   3. Run: pg_prove -d <db> website/supabase/tests/register_device_atomic.test.sql
--
-- These tests exercise the REAL SQL function (not a JS mirror) for the
-- decision table:
--   new device       + activeCount < 3 -> allowed
--   new device       + activeCount = 3 -> denied (limit_reached)
--   active device    + activeCount = 3 -> allowed (refresh, no new slot)
--   revoked device   + activeCount = 3 -> denied (reactivation == new)
--   revoked device   + activeCount < 3 -> allowed (reactivation)
--   lifetime user    + any -> allowed
--
-- NOTE: This suite is not wired into GitHub Actions CI yet because the
-- repository does not provision a Postgres/Supabase test database on the
-- runner. It is the canonical database-backed coverage for the function.

BEGIN;

SELECT plan(7);

-- Fixture user (bypasses auth for direct function calls)
SELECT lives_ok(
  $$ INSERT INTO public.devices (user_id, device_id, platform)
     VALUES ('00000000-0000-0000-0000-000000000001', 'dev-new', 'windows') $$,
  'seed new device'
);

-- 1. New device under limit -> allowed
SELECT is(
  (public.register_device_atomic(
     '00000000-0000-0000-0000-000000000001', 'dev-new', NULL, 'windows', '1.0.0', false
   )->>'success')::boolean,
  true,
  'new device allowed when activeCount < 3'
);

-- 2. Fill to 3 active devices
SELECT lives_ok(
  $$ INSERT INTO public.devices (user_id, device_id, platform)
     VALUES
       ('00000000-0000-0000-0000-000000000001', 'dev-a', 'windows'),
       ('00000000-0000-0000-0000-000000000001', 'dev-b', 'windows'),
       ('00000000-0000-0000-0000-000000000001', 'dev-c', 'windows') $$,
  'seed three active devices'
);

-- 3. New device at limit -> denied
SELECT is(
  (public.register_device_atomic(
     '00000000-0000-0000-0000-000000000001', 'dev-d', NULL, 'windows', '1.0.0', false
   )->>'limit_reached')::boolean,
  true,
  'new device denied at the 3-device limit'
);

-- 4. Active-device refresh at limit -> allowed (refresh is not a new slot)
SELECT is(
  (public.register_device_atomic(
     '00000000-0000-0000-0000-000000000001', 'dev-a', 'Renamed', 'windows', '2.0.0', false
   )->>'success')::boolean,
  true,
  'active device refresh allowed at the 3-device limit'
);
SELECT is(
  (SELECT label FROM public.devices WHERE device_id = 'dev-a' AND user_id = '00000000-0000-0000-0000-000000000001'),
  'Renamed',
  'active refresh updates provided label'
);

-- 5. Revoked device at limit -> denied (reactivation counts as new)
UPDATE public.devices
   SET revoked_at = now()
 WHERE device_id = 'dev-a' AND user_id = '00000000-0000-0000-0000-000000000001';

SELECT is(
  (public.register_device_atomic(
     '00000000-0000-0000-0000-000000000001', 'dev-a', NULL, 'windows', '1.0.0', false
   )->>'limit_reached')::boolean,
  true,
  'revoked device reactivation denied at the 3-device limit'
);

-- 6. Revoked device under limit -> allowed (reactivation)
UPDATE public.devices
   SET revoked_at = now()
 WHERE device_id = 'dev-b' AND user_id = '00000000-0000-0000-0000-000000000001';

SELECT is(
  (public.register_device_atomic(
     '00000000-0000-0000-0000-000000000001', 'dev-b', NULL, 'windows', '1.0.0', false
   )->>'success')::boolean,
  true,
  'revoked device reactivation allowed when under the limit'
);

-- 7. Lifetime user, at limit -> allowed
SELECT is(
  (public.register_device_atomic(
     '00000000-0000-0000-0000-000000000001', 'dev-lifetime', NULL, 'windows', '1.0.0', true
   )->>'success')::boolean,
  true,
  'lifetime user allowed regardless of device count'
);

-- Cleanup fixture-only rows
DELETE FROM public.devices WHERE user_id = '00000000-0000-0000-0000-000000000001';

SELECT * FROM finish();
ROLLBACK;
