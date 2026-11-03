-- Run once in the hosted Supabase project after applying migration 013.
-- Schedules regular redaction of email outbox rows older than 90 days.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'soravo-cleanup-email-outbox-retention';

SELECT cron.schedule(
  'soravo-cleanup-email-outbox-retention',
  '0 3 * * *',
  $$SELECT public.cleanup_email_outbox_retention(90);$$
);
