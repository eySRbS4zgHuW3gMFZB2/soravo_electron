import {
  createS256Challenge,
  DESKTOP_OTP_TYPE,
  HANDOFF_CODE_ALPHABET,
  HANDOFF_TTL_MS,
  isValidChallenge,
  isValidHandoffCode,
  isValidState,
  isValidVerifier,
  randomString,
} from "./contract.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AuthError = unknown;

interface AuthUser {
  id: string;
  email?: string | null;
}

interface QueryResult {
  data?: unknown;
  error?: unknown;
}

interface HandoffQuery extends PromiseLike<QueryResult> {
  delete(): HandoffQuery;
  eq(column: string, value: string): HandoffQuery;
  gt(column: string, value: string): HandoffQuery;
  insert(values: Record<string, unknown>): HandoffQuery;
  is(column: string, value: null): HandoffQuery;
  lte(column: string, value: string): HandoffQuery;
  limit(count: number): HandoffQuery;
  select(columns: string): HandoffQuery;
}

export interface AuthClient {
  auth: {
    getUser(token: string): Promise<{ data: { user: AuthUser | null }; error: AuthError }>;
    admin?: {
      generateLink(input: { type: "magiclink"; email: string }): Promise<{
        data: { properties?: { hashed_token?: string; verification_type?: string } } | null;
        error: AuthError;
      }>;
    };
  };
  from(table: string): HandoffQuery;
}

interface HandoffRow {
  id: string;
  code_challenge: string;
  state: string;
  token_hash: string;
  expires_at: string;
  consumed_at: string | null;
}

export interface HandlerDependencies {
  readEnvironment(): {
    supabaseUrl?: string;
    anonKey?: string;
    serviceKey?: string;
  };
  createClient(url: string, key: string): AuthClient;
  now(): Date;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sha256Hex(value: string): Promise<string> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)).then((digest) =>
    Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstRow(data: unknown): HandoffRow | null {
  if (!Array.isArray(data) || data.length !== 1 || !isRecord(data[0])) return null;
  const row = data[0];
  if (
    typeof row.id !== "string" ||
    typeof row.code_challenge !== "string" ||
    typeof row.state !== "string" ||
    typeof row.token_hash !== "string" ||
    typeof row.expires_at !== "string" ||
    (row.consumed_at !== null && typeof row.consumed_at !== "string")
  ) return null;
  return row as unknown as HandoffRow;
}

function isHandoffInsertResult(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (value.error) return false;
  return value.data === null || value.data === undefined;
}

function firstTokenHash(data: unknown): string | null {
  if (!Array.isArray(data) || data.length !== 1 || !isRecord(data[0])) return null;
  return typeof data[0].token_hash === "string" ? data[0].token_hash : null;
}

export function createDesktopAuthHandoffHandler(dependencies: HandlerDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (request.method !== "POST") return json(405, { error: "Method not allowed" });

    const { supabaseUrl, anonKey, serviceKey } = dependencies.readEnvironment();
    if (!supabaseUrl || !anonKey || !serviceKey) return json(500, { error: "Server misconfigured" });

    let body: Record<string, unknown>;
    try {
      const parsed: unknown = await request.json();
      if (!isRecord(parsed)) return json(400, { error: "Invalid JSON" });
      body = parsed;
    } catch {
      return json(400, { error: "Invalid JSON" });
    }

    const action = body.action;
    if (action !== "issue" && action !== "exchange") return json(400, { error: "Invalid action" });

    if (action === "issue") {
      const authorization = request.headers.get("Authorization");
      if (!authorization?.startsWith("Bearer ")) return json(401, { error: "Missing authorization" });
      const accessToken = authorization.slice("Bearer ".length).trim();
      if (!accessToken) return json(401, { error: "Missing authorization" });

      const browser = dependencies.createClient(supabaseUrl, anonKey);
      const { data: { user }, error: authError } = await browser.auth.getUser(accessToken);
      if (authError) {
        const status = (authError as { status?: unknown } | null)?.status;
        if (typeof status !== "number" || status === 0 || status >= 500) {
          console.error("desktop-auth-handoff: auth.getUser failed", authError);
          return json(503, { error: "Authentication service unavailable" });
        }
        return json(401, { error: "Invalid session" });
      }
      if (!user?.email) return json(401, { error: "Invalid session" });

      const state = body.state;
      const challenge = body.code_challenge;
      if (!isValidState(state) || !isValidChallenge(challenge) || body.code_challenge_method !== "S256") {
        return json(400, { error: "Invalid request" });
      }

      const admin = dependencies.createClient(supabaseUrl, serviceKey);
      const cleanupResult = await admin
        .from("desktop_auth_handoffs")
        .delete()
        .eq("user_id", user.id)
        .lte("expires_at", dependencies.now().toISOString());
      if (cleanupResult.error) return json(500, { error: "Failed to prepare handoff" });

      const adminAuth = admin.auth.admin;
      if (!adminAuth) return json(500, { error: "Server misconfigured" });
      const { data: linkData, error: linkError } = await adminAuth.generateLink({
        type: DESKTOP_OTP_TYPE,
        email: user.email,
      });
      const tokenHash = linkData?.properties?.hashed_token;
      if (
        linkError ||
        typeof tokenHash !== "string" ||
        !tokenHash ||
        linkData?.properties?.verification_type !== DESKTOP_OTP_TYPE
      ) return json(500, { error: "Failed to prepare desktop sign-in token" });

      const code = randomString(32, HANDOFF_CODE_ALPHABET);
      const codeHash = await sha256Hex(code);
      const expiresAt = new Date(dependencies.now().getTime() + HANDOFF_TTL_MS).toISOString();
      const insertResult = await admin.from("desktop_auth_handoffs").insert({
        user_id: user.id,
        code_hash: codeHash,
        code_challenge: challenge,
        state,
        token_hash: tokenHash,
        expires_at: expiresAt,
      });
      if (!isHandoffInsertResult(insertResult)) return json(500, { error: "Failed to issue handoff" });
      return json(200, { code, state, expires_at: expiresAt });
    }

    const code = body.code;
    const verifier = body.code_verifier;
    const state = body.state;
    if (!isValidVerifier(verifier) || !isValidState(state)) {
      return json(400, { error: "Invalid request" });
    }
    if (!isValidHandoffCode(code)) return json(400, { error: "Invalid request" });
    const lookupValue = await sha256Hex(code);

    const admin = dependencies.createClient(supabaseUrl, serviceKey);
    const { data: rows, error: lookupError } = await admin
      .from("desktop_auth_handoffs")
      .select("id, code_hash, code_challenge, state, token_hash, expires_at, consumed_at")
      .eq("code_hash", lookupValue)
      .limit(1);
    if (lookupError) return json(500, { error: "Lookup failed" });
    const record = firstRow(rows);
    if (!record || record.consumed_at || new Date(record.expires_at).getTime() <= dependencies.now().getTime()) {
      return json(401, { error: "Invalid or expired code" });
    }
    if (record.state !== state) return json(401, { error: "State mismatch" });
    if (await createS256Challenge(verifier) !== record.code_challenge) {
      return json(401, { error: "PKCE verification failed" });
    }

    // One conditional DELETE is the consume operation. Concurrent exchanges
    // can both read the row, but only one DELETE can return its token hash.
    const consumed = await admin
      .from("desktop_auth_handoffs")
      .delete()
      .eq("id", record.id)
      .is("consumed_at", null)
      .gt("expires_at", dependencies.now().toISOString())
      .select("token_hash");
    const tokenHash = firstTokenHash(consumed.data);
    if (consumed.error) return json(500, { error: "Failed to consume handoff" });
    if (!tokenHash) return json(409, { error: "Code already consumed" });

    return json(200, {
      token_hash: tokenHash,
      state: record.state,
      otp_type: DESKTOP_OTP_TYPE,
    });
  };
}
