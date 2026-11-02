-- Run once in the hosted Supabase project's SQL editor after applying
-- migrations 009 and 010. This schedules regular removal of expired token
-- hashes; issue requests also remove expired rows for the current user.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'soravo-cleanup-expired-desktop-auth-handoffs';

SELECT cron.schedule(
  'soravo-cleanup-expired-desktop-auth-handoffs',
  '* * * * *',
  $$DELETE FROM public.desktop_auth_handoffs WHERE expires_at <= now()$$
);
