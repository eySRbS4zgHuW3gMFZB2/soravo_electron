/**
 * Safe construction and validation of Supabase Auth redirect URLs.
 *
 * Supabase Auth ignores a redirect target unless its origin (and usually its
 * full URL) is present in the project's allowlist. We therefore never derive a
 * redirect from an untrusted request or user-supplied value: only the current
 * deployment origin / configured site origin and a small set of known paths may
 * be used.
 */

export const AUTH_REDIRECT_PATHS = {
  account: "/account",
  resetPassword: "/reset-password",
  login: "/login",
} as const;

const ALLOWED_AUTH_PATHS = new Set<string>(Object.values(AUTH_REDIRECT_PATHS));

const PRODUCTION_ORIGIN = "https://soravo.xyz";
const PREVIEW_ORIGIN_SUFFIX = ".pages.dev";

export type AuthRedirectPath = (typeof AUTH_REDIRECT_PATHS)[keyof typeof AUTH_REDIRECT_PATHS];

/** Validate a full auth redirect origin without userinfo, path, query, or hash. */
export function isValidAuthOrigin(value: unknown): value is string {
  if (typeof value !== "string" || value.trim() === "") return false;
  const candidate = value.trim().replace(/\/+$/, "");
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return false;
  }
  if (url.origin !== candidate) return false;
  if (url.username || url.password) return false;
  if (url.pathname !== "/" || url.search !== "" || url.hash !== "") return false;
  if (url.protocol === "https:") return true;
  if (url.protocol === "http:") {
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  }
  return false;
}

/** Reject arbitrary paths so auth flows cannot become an open redirect. */
export function isAllowedAuthRedirectPath(value: unknown): value is AuthRedirectPath {
  return typeof value === "string" && ALLOWED_AUTH_PATHS.has(value);
}

/** Normalize a candidate path to one of the allowlisted auth paths. */
export function normalizeAuthRedirectPath(value: string | null | undefined): AuthRedirectPath {
  if (typeof value !== "string") return AUTH_REDIRECT_PATHS.account;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || /[\\]/.test(trimmed) || /[\u0000-\u001f\u007f]/.test(trimmed)) {
    return AUTH_REDIRECT_PATHS.account;
  }
  try {
    const url = new URL(trimmed, "http://soravo.invalid");
    if (url.origin !== "http://soravo.invalid") return AUTH_REDIRECT_PATHS.account;
    if (url.pathname.includes("\\") || url.search.includes("\\") || url.hash.includes("\\")) {
      return AUTH_REDIRECT_PATHS.account;
    }
    if (!ALLOWED_AUTH_PATHS.has(url.pathname)) return AUTH_REDIRECT_PATHS.account;
    return url.pathname as AuthRedirectPath;
  } catch {
    return AUTH_REDIRECT_PATHS.account;
  }
}

/** Resolve the deployment origin used for auth redirects. */
export function getAuthRedirectOrigin(
  envOrigin: string | undefined = (typeof import.meta !== "undefined"
    ? ((import.meta as ImportMeta).env?.VITE_SITE_URL as string | undefined)
    : undefined),
  runtimeOrigin: string | undefined = typeof window !== "undefined" ? window.location.origin : undefined
): string {
  if (isValidAuthOrigin(envOrigin)) return (envOrigin as string).trim().replace(/\/+$/, "");
  if (isValidAuthOrigin(runtimeOrigin)) return (runtimeOrigin as string).trim().replace(/\/+$/, "");
  return "";
}

/** Build an absolute auth redirect URL from an allowlisted path. */
export function getAuthRedirectUrl(
  path: AuthRedirectPath | string = AUTH_REDIRECT_PATHS.account,
  origin?: string
): string {
  const safePath = normalizeAuthRedirectPath(path);
  const base = origin && isValidAuthOrigin(origin)
    ? origin.trim().replace(/\/+$/, "")
    : getAuthRedirectOrigin();
  return base ? `${base}${safePath}` : safePath;
}

/** Alias used by callers/tests that prefer "redirect target" wording. */
export const resolveAuthRedirectUrl = getAuthRedirectUrl;

/** True when the supplied origin is allowlisted for the given origins. */
export function isAllowedAuthRedirectOrigin(
  candidate: string,
  allowedOrigins: Iterable<string> = []
): boolean {
  if (!isValidAuthOrigin(candidate)) return false;
  const normalized = candidate.trim().replace(/\/+$/, "");
  return Array.from(allowedOrigins).some((origin) => {
    if (typeof origin !== "string") return false;
    return origin.trim().replace(/\/+$/, "") === normalized;
  });
}

/** Alias for the recovery flow's exported name. */
export const recoveryRedirectUrl = (): string => getAuthRedirectUrl(AUTH_REDIRECT_PATHS.resetPassword);

export interface SupabaseAuthCallback {
  type: string | null;
  errorCode: string | null;
  errorDescription: string | null;
  accessTokenPresent: boolean;
  refreshTokenPresent: boolean;
  codePresent: boolean;
  state: string | null;
  hasSuccessfulTokens: boolean;
  isMalformed: boolean;
}

function readParams(raw: string): URLSearchParams {
  const value = raw.trim();
  if (!value) return new URLSearchParams();
  // Hash and query strings are both used by Supabase depending on flow.
  const hashIndex = value.indexOf("#");
  const queryIndex = value.indexOf("?");
  if (hashIndex >= 0) return new URLSearchParams(value.slice(hashIndex + 1));
  if (queryIndex >= 0) return new URLSearchParams(value.slice(queryIndex + 1));
  try {
    const url = new URL(value);
    const fromHash = url.hash ? new URLSearchParams(url.hash.slice(1)) : null;
    const fromSearch = url.search ? new URLSearchParams(url.search.slice(1)) : null;
    if (fromHash && fromHash.toString() !== "") return fromHash;
    if (fromSearch) return fromSearch;
  } catch {
    return new URLSearchParams(value);
  }
  return new URLSearchParams();
}

/** Parse a Supabase redirect URL into a small, safe callback summary. */
export function parseSupabaseAuthCallback(rawUrlOrHash = typeof window !== "undefined"
  ? window.location.href
  : ""): SupabaseAuthCallback {
  const params = readParams(rawUrlOrHash);
  const type = params.get("type");
  const errorCode = params.get("error") ?? params.get("error_code");
  const errorDescription = params.get("error_description");
  const accessTokenPresent = params.has("access_token") && Boolean(params.get("access_token"));
  const refreshTokenPresent = params.has("refresh_token") && Boolean(params.get("refresh_token"));
  const codePresent = params.has("code") && Boolean(params.get("code"));
  const state = params.get("state");
  const hasSuccessfulTokens = accessTokenPresent && refreshTokenPresent;
  const isMalformed =
    errorCode !== null ||
    (type !== null && !["signup", "recovery", "magiclink", "invite", "email_change"].includes(type)) ||
    (type === "recovery" && !accessTokenPresent && !codePresent);
  return {
    type,
    errorCode,
    errorDescription,
    accessTokenPresent,
    refreshTokenPresent,
    codePresent,
    state,
    hasSuccessfulTokens,
    isMalformed,
  };
}

/** Export common aliases expected by future tests. */
export const parseAuthCallback = parseSupabaseAuthCallback;
export const classifyAuthCallback = parseSupabaseAuthCallback;
export const isAllowedAuthRedirectOriginExact = isAllowedAuthRedirectOrigin;

export { PRODUCTION_ORIGIN, PREVIEW_ORIGIN_SUFFIX };

// Intentionally allow callers to improve error UX without leaking tokens.
export function sanitizeAuthErrorMessage(value: string | null | undefined): string {
  if (!value) return "This confirmation or recovery link is invalid or has expired.";
  const lower = value.toLowerCase();
  if (lower.includes("expired")) return "This link has expired. Request a new one and try again.";
  if (lower.includes("invalid") || lower.includes("otp")) return "This link is invalid or has expired. Request a new one and try again.";
  // Avoid forwarding arbitrary provider text that may contain sensitive redirect data.
  return "This confirmation or recovery link is invalid or has expired.";
}
