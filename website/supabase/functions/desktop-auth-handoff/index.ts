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

function base64UrlFromDigest(digest: ArrayBuffer): string {
  const b64 = bytesToBase64(new Uint8Array(digest));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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
  const action = body?.action;

  if (action !== "issue" && action !== "exchange") return json(400, { error: "Invalid action" });

  const projectUrl = supabaseUrl;

  if (action === "issue") {
    if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Missing authorization" });
    const token = authHeader.slice(7).trim();
    const browser = createClient(projectUrl, anonKey);
    const { data: { user }, error } = await browser.auth.getUser(token);
    if (error || !user?.email) return json(401, { error: "Invalid session" });

    const state = body?.state;
    const codeChallenge = body?.code_challenge;
    if (typeof state !== "string" || typeof codeChallenge !== "string") return json(400, { error: "Invalid request" });

    // Ask Supabase to generate an independent magic-link token for this same user.
    const admin = createClient(projectUrl, serviceKey);
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: user.email,
    });
    if (linkError || !linkData?.properties?.hashed_token) return json(500, { error: "Failed to prepare desktop sign-in token" });

    const rawCode = Array.from(randomBytes(32)).map((b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".charAt(b % 62)).join("");
    const codeHash = await sha256Hex(rawCode);
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();

    const { error: insertError } = await admin.from("desktop_auth_handoffs").insert({
      user_id: user.id,
      code_hash: codeHash,
      code_challenge: codeChallenge,
      state,
      token_hash: linkData.properties.hashed_token,
      expires_at: expiresAt,
    });
    if (insertError) return json(500, { error: "Failed to issue handoff" });

    return json(200, { code: rawCode, state, expires_at: expiresAt });
  }

  const code = body?.code;
  const verifier = body?.code_verifier;
  const state = body?.state;
  if (typeof code !== "string" || typeof verifier !== "string" || typeof state !== "string") return json(400, { error: "Invalid request" });
  const codeHash = await sha256Hex(code);

  const admin = createClient(projectUrl, serviceKey);
  const { data: rows, error: lookupError } = await admin
    .from("desktop_auth_handoffs")
    .select("id, code_hash, code_challenge, state, token_hash, expires_at, consumed_at")
    .eq("code_hash", codeHash)
    .limit(1);
  if (lookupError) return json(500, { error: "Lookup failed" });
  const record = rows?.[0];
  if (!record || record.consumed_at || new Date(record.expires_at).getTime() < Date.now()) {
    return json(401, { error: "Invalid or expired code" });
  }
  if (record.state !== state) return json(401, { error: "State mismatch" });

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = base64UrlFromDigest(digest);
  if (challenge !== record.code_challenge) return json(401, { error: "PKCE verification failed" });

  const consumed = await admin
    .from("desktop_auth_handoffs")
    .delete()
    .eq("id", record.id)
    .is("consumed_at", null)
    .select("token_hash");
  if (!consumed.data || consumed.data.length !== 1) return json(409, { error: "Code already consumed" });

  return json(200, { token_hash: consumed.data[0].token_hash, state: record.state });
});
