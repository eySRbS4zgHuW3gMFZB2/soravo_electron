-- Minimal Supabase-compatible bootstrap for disposable PostgreSQL test runs.
-- This is NOT a production Supabase schema. It provides only the objects
-- required by 001_initial_schema.sql and the pgTAP SQL tests:
--   * roles anon, authenticated, service_role
--   * auth schema with a minimal auth.users table and auth.uid()
--   * pgcrypto (gen_random_uuid) and pgtap extensions
--
-- Differences from Supabase:
--   - auth.uid() always returns NULL (no JWT/session context in raw Postgres).
--   - auth.users lacks most Supabase columns/constraints and triggers.
--   - service_role is granted BYPASSRLS for test convenience but is not the
--     Supabase-managed role.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pgtap;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END
$$;

CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULL::uuid;
$$;

CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY,
  email text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  banned_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  confirmation_token text,
  email_change text,
  email_change_token_new text,
  recovery_token text,
  raw_user_meta_data jsonb
);

-- Grant minimal schema usage so role-based tests can reference objects.
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
GRANT SELECT ON auth.users TO service_role;