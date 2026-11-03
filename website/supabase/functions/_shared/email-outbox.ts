export const MAX_EMAIL_ATTEMPTS = 8;

/**
 * Bounded exponential backoff with jitter for retryable email failures.
 * Prevents retry storms while allowing recovery from transient outages.
 */
export function emailBackoffMs(attempt: number, baseMs = 60_000): number {
  const safeAttempt = Math.max(1, Math.min(attempt, 12));
  const exponential = Math.min(baseMs * 2 ** (safeAttempt - 1), 15 * 60_000);
  const jitter = Math.round(exponential * (0.8 + Math.random() * 0.4));
  return Math.max(baseMs, jitter);
}
