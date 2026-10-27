-- Replace the prior predicate for databases that have already applied 003.
-- Fail transactionally if existing rows violate the wider uniqueness guard.
BEGIN;

DROP INDEX IF EXISTS public.idx_subscriptions_one_open_monthly_per_user;
CREATE UNIQUE INDEX idx_subscriptions_one_open_monthly_per_user
  ON public.subscriptions (user_id)
  WHERE status IN ('created', 'authenticated', 'active', 'pending', 'resumed');

COMMIT;
