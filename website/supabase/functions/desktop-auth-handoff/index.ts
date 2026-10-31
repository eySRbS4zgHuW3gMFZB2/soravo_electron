import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function base64ToBytes(value: string): Uint8Array {
  const s = atob(value);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function sha256Hex(value: string): Promise<string> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)).then((digest) =>
    Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("")
  );
}

// 32-byte AES key derived from server-only secret.
async function getKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("DESKTOP_AUTH_EXPIRY_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptSession(value: unknown): Promise<string> {
  const key = await getKey();
  const iv = randomBytes(12);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as unknown as BufferSource }, key, new TextEncoder().encode(JSON.stringify(value)) as unknown as BufferSource);
  const out = new Uint8Array(iv.length + ciphertext.byteLength);
  out.set(iv);
  out.set(new Uint8Array(ciphertext), iv.length);
  return bytesToBase64(out);
}

async function decryptSession(value: string): Promise<unknown> {
  const bytes = base64ToBytes(value);
  const iv = bytes.slice(0, 12);
  const ciphertext = bytes.slice(12);
  const key = await getKey();
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as unknown as BufferSource }, key, ciphertext as unknown as BufferSource);
  return JSON.parse(new TextDecoder().decode(plaintext));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) return json(500, { error: "Server misconfigured" });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const authHeader = req.headers.get("Authorization");
  // ISSUE
  if (body?.action === "issue") {
    if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Missing authorization" });
    const token = authHeader.slice(7).trim();
    const browser = createClient(supabaseUrl, anonKey);
    const { data: { user }, error } = await browser.auth.getUser(token);
    if (error || !user) return json(401, { error: "Invalid session" });

    const state = body?.state;
    const codeChallenge = body?.code_challenge;
    const refreshToken = body?.refresh_token;
    if (typeof state !== "string" || typeof codeChallenge !== "string" || typeof refreshToken !== "string") {
      return json(400, { error: "Invalid request" });
    }

    const rawCode = Array.from(randomBytes(32)).map((b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".charAt(b % 62)).join("");
    const codeHash = await sha256Hex(rawCode);
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    const sessionPayload = { access_token: token, refresh_token: refreshToken, user_id: user.id };
    const encrypted = await encryptSession(sessionPayload);

    const admin = createClient(supabaseUrl, serviceKey);
    const { error: insertError } = await admin.from("desktop_auth_handoffs").insert({
      user_id: user.id,
      code_hash: codeHash,
      code_challenge: codeChallenge,
      state,
      encrypted_session: encrypted,
      expires_at: expiresAt,
    });
    if (insertError) return json(500, { error: "Failed to issue handoff" });

    return json(200, { code: rawCode, state, expires_at: expiresAt });
  }

  // EXCHANGE
  if (body?.action === "exchange") {
    const code = body?.code;
    const verifier = body?.code_verifier;
    const state = body?.state;
    if (typeof code !== "string" || typeof verifier !== "string" || typeof state !== "string") return json(400, { error: "Invalid request" });
    const codeHash = await sha256Hex(code);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: rows, error: lookupError } = await admin
      .from("desktop_auth_handoffs")
      .select("id, code_hash, code_challenge, state, encrypted_session, expires_at, consumed_at")
      .eq("code_hash", codeHash)
      .limit(1);
    if (lookupError) return json(500, { error: "Lookup failed" });
    const record = rows?.[0];
    if (!record || record.consumed_at || new Date(record.expires_at).getTime() < Date.now()) {
      return json(401, { error: "Invalid or expired code" });
    }
    if (record.state !== state) return json(401, { error: "State mismatch" });

    // NOTE: PKCE S256 requires base64url(SHA256(verifier)), not a hex conversion.
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    const challenge = bytesToBase64(new Uint8Array(digest)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    if (challenge !== record.code_challenge) return json(401, { error: "PKCE verification failed" });

    const consumed = await admin
      .from("desktop_auth_handoffs")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", record.id)
      .is("consumed_at", null)
      .select("id");
    if (!consumed.data || consumed.data.length !== 1) return json(409, { error: "Code already consumed" });

    const session = await decryptSession(record.encrypted_session);
    return json(200, { session, state: record.state });
  }

  return json(400, { error: "Invalid action" });
});
