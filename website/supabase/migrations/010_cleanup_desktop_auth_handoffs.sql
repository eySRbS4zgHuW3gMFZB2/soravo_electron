-- Remove expired token hashes during migration replay. Issue requests also
-- remove expired rows belonging to the current user.
BEGIN;

DELETE FROM public.desktop_auth_handoffs WHERE expires_at <= now();

COMMIT;
