-- Return only the requested search page to the Edge Function. The total still
-- requires counting all matches; Auth users and profile names never leave the
-- database except for the selected page.
BEGIN;

CREATE OR REPLACE FUNCTION public.admin_dashboard_search_users(
  search_text text,
  page_number integer,
  page_size integer
) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH params AS (
    SELECT lower(left(btrim(coalesce(search_text, '')), 120)) AS query,
      least(greatest(coalesce(page_number, 1), 1), 1000) AS page,
      least(greatest(coalesce(page_size, 25), 1), 50) AS size
  ), matches AS MATERIALIZED (
    SELECT u.id, u.email, u.created_at, u.email_confirmed_at, u.banned_until,
      strpos(lower(coalesce(u.email, '')), p.query) > 0 AS email_match
    FROM auth.users AS u
    LEFT JOIN public.profiles AS profile ON profile.user_id = u.id
    CROSS JOIN params AS p
    WHERE p.query <> '' AND (
      strpos(lower(coalesce(u.email, '')), p.query) > 0 OR
      strpos(lower(coalesce(profile.display_name, '')), p.query) > 0
    )
  ), page_rows AS (
    SELECT * FROM matches
    ORDER BY email_match DESC, created_at ASC, id ASC
    LIMIT (SELECT size FROM params)
    OFFSET (SELECT (page - 1) * size FROM params)
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM matches),
    'users', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'email', email, 'created_at', created_at,
        'email_confirmed_at', email_confirmed_at, 'banned_until', banned_until
      ) ORDER BY email_match DESC, created_at ASC, id ASC)
      FROM page_rows
    ), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.admin_dashboard_search_users(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_search_users(text, integer, integer) TO service_role;

COMMIT;
