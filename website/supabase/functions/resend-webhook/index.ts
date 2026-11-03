import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const APPROVED_RESEND_EVENTS = new Set([
  "email.sent",
  "email.delivered",
  "email.delivery_delayed",
  "email.bounced",
  "email.complained",
  "email.failed",
  "email.suppressed",
]);

const REPLAY_TOLERANCE_SECONDS = 300;
// Allow time for the sending worker to save the provider message ID. Auth SMTP
// and other unrelated messages can have no outbox row and are acknowledged later.
const OUTBOX_MATCH_RETRY_WINDOW_MS = 5 * 60_000;

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of arr) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function safeCompareBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function getSecretBytes(secret: string): Uint8Array {
  const normalized = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  try {
    return fromBase64(normalized);
  } catch {
    return new TextEncoder().encode(normalized);
  }
}

async function verifySvixSignature(rawBody: string, headers: Headers, secret: string): Promise<boolean> {
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signatureHeader = headers.get("svix-signature");
  if (!id || !timestamp || !signatureHeader) return false;

  const tsSeconds = Number(timestamp);
  if (!Number.isFinite(tsSeconds)) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - tsSeconds) > REPLAY_TOLERANCE_SECONDS) return false;

  const secretBytes = getSecretBytes(secret);
  const key = await crypto.subtle.importKey("raw", Uint8Array.from(secretBytes), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signedContent = `${id}.${timestamp}.${rawBody}`;
  const expectedDigest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedContent)));
  const expectedBase64 = toBase64(expectedDigest);

  const candidates = signatureHeader.split(" ");
  for (const candidate of candidates) {
    const parts = candidate.split(",");
    if (parts.length !== 2 || parts[0] !== "v1") continue;
    try {
      const actualBytes = fromBase64(parts[1]);
      if (safeCompareBytes(actualBytes, expectedDigest)) return true;
    } catch {
      if (parts[1] === expectedBase64) return true;
    }
  }
  return false;
}

function deliveryStatusForType(type: string): string | null {
  switch (type) {
    case "email.sent": return "sent";
    case "email.delivered": return "delivered";
    case "email.delivery_delayed": return "delayed";
    case "email.bounced": return "bounced";
    case "email.complained": return "complained";
    case "email.failed": return "failed";
    case "email.suppressed": return "suppressed";
    default: return null;
  }
}

const DELIVERY_RANK: Record<string, number> = {
  sent: 1,
  delayed: 2,
  delivered: 3,
  failed: 4,
  bounced: 5,
  complained: 6,
  suppressed: 7,
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const secret = Deno.env.get("RESEND_WEBHOOK_SECRET");
  if (!secret) {
    return new Response("Webhook not configured", { status: 503 });
  }

  const rawBody = await req.text();

  const validSignature = await verifySvixSignature(rawBody, req.headers, secret).catch(() => false);
  if (!validSignature) {
    return new Response("Invalid signature", { status: 401 });
  }

  let event: { id?: unknown; type?: unknown; created_at?: unknown; data?: unknown };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const type = typeof event?.type === "string" ? event.type : null;
  if (!type) {
    return new Response("Missing event type", { status: 400 });
  }
  if (!APPROVED_RESEND_EVENTS.has(type)) {
    return new Response(JSON.stringify({ status: "ignored", reason: "unknown_event_type" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const data = (event.data && typeof event.data === "object") ? (event.data as Record<string, unknown>) : null;
  const emailId = typeof data?.email_id === "string" ? data.email_id : null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  const admin = createClient(supabaseUrl, serviceKey);

  const providerEventId = (typeof req.headers.get("svix-id") === "string" && req.headers.get("svix-id")!.trim())
    ? req.headers.get("svix-id")!.trim()
    : (typeof event.id === "string" && event.id.trim() ? event.id.trim() : `${type}:${emailId ?? "unknown"}`);

  // Idempotency check.
  const { data: existing, error: existingError } = await admin
    .from("webhook_events")
    .select("id, processing_status")
    .eq("provider", "resend")
    .eq("provider_event_id", providerEventId)
    .maybeSingle();
  if (existingError) {
    return new Response(JSON.stringify({ error: "Persistence failed" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
  if (existing?.processing_status === "processed") {
    return new Response(JSON.stringify({ status: "duplicate" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  if (!existing) {
    const { error: insertError } = await admin.from("webhook_events").insert({
      provider: "resend",
      provider_event_id: providerEventId,
      event_type: type,
      signature_valid: true,
      processing_status: "received",
    } as Record<string, unknown>);
    if (insertError) {
      const { data: retryExisting } = await admin
        .from("webhook_events")
        .select("processing_status")
        .eq("provider", "resend")
        .eq("provider_event_id", providerEventId)
        .maybeSingle();
      if (retryExisting?.processing_status === "processed") {
        return new Response(JSON.stringify({ status: "duplicate" }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: "Persistence failed" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
  }

  const claimToken = crypto.randomUUID();
  const claimNow = new Date().toISOString();
  const leaseUntil = new Date(Date.now() + 60_000).toISOString();
  let { data: claimedRows, error: claimError } = await admin
    .from("webhook_events")
    .update({
      processing_status: "processing",
      claim_token: claimToken,
      claimed_at: claimNow,
      lease_expires_at: leaseUntil,
    })
    .eq("provider", "resend")
    .eq("provider_event_id", providerEventId)
    .in("processing_status", ["received", "failed"])
    .select("id, received_at");

  if (claimError) {
    return new Response(JSON.stringify({ error: "Persistence failed" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
  if (!claimedRows?.length) {
    ({ data: claimedRows, error: claimError } = await admin
      .from("webhook_events")
      .update({
        processing_status: "processing",
        claim_token: claimToken,
        claimed_at: claimNow,
        lease_expires_at: leaseUntil,
      })
      .eq("provider", "resend")
      .eq("provider_event_id", providerEventId)
      .eq("processing_status", "processing")
      .lt("lease_expires_at", claimNow)
      .select("id, received_at"));
    if (claimError) {
      return new Response(JSON.stringify({ error: "Persistence failed" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
  }
  if (!claimedRows?.length) {
    const { data: current } = await admin
      .from("webhook_events")
      .select("processing_status")
      .eq("provider", "resend")
      .eq("provider_event_id", providerEventId)
      .maybeSingle();
    if (current?.processing_status === "processed") {
      return new Response(JSON.stringify({ status: "duplicate" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ status: "processing" }), { status: 503, headers: { "Content-Type": "application/json" } });
  }

  try {
    const newStatus = deliveryStatusForType(type)!;
    const deliveryRank = DELIVERY_RANK[newStatus] ?? 0;

    // Update any email outbox rows matching the provider message id, using
    // out-of-order-safe rank comparisons.
    if (emailId) {
      const eligible = Object.entries(DELIVERY_RANK)
        .filter(([, rank]) => rank <= deliveryRank)
        .map(([status]) => status);
      const now = new Date().toISOString();
      const { data: updatedRows, error: updateError } = await admin
        .from("email_outbox")
        .update({ delivery_status: newStatus, delivery_updated_at: now, updated_at: now })
        .eq("provider_message_id", emailId)
        .or(`delivery_status.is.null,delivery_status.in.(${eligible.join(",")})`)
        .select("id");
      if (updateError) throw updateError;
      if (!updatedRows?.length) {
        // A higher-ranked status also yields zero updates; it is already handled.
        const { data: matchingRows, error: lookupError } = await admin
          .from("email_outbox")
          .select("id, delivery_status")
          .eq("provider_message_id", emailId);
        if (lookupError) throw lookupError;
        if (!matchingRows?.length) {
          const receivedAt = Date.parse(claimedRows[0].received_at);
          if (!Number.isFinite(receivedAt) || Date.now() - receivedAt < OUTBOX_MATCH_RETRY_WINDOW_MS) {
            throw new Error("outbox row not yet available");
          }
        } else if (matchingRows.some((row) => (DELIVERY_RANK[row.delivery_status] ?? 0) <= deliveryRank)) {
          // The outbox row may have appeared after the first update.
          const { data: lateRows, error: lateError } = await admin
            .from("email_outbox")
            .update({ delivery_status: newStatus, delivery_updated_at: now, updated_at: now })
            .eq("provider_message_id", emailId)
            .or(`delivery_status.is.null,delivery_status.in.(${eligible.join(",")})`)
            .select("id");
          if (lateError) throw lateError;
          if (!lateRows?.length) throw new Error("outbox row changed during delivery update");
        }
      }
    }

    const { data: finalizedRows, error: finalizeError } = await admin
      .from("webhook_events")
      .update({
        processing_status: "processed",
        processed_at: new Date().toISOString(),
      })
      .eq("provider", "resend")
      .eq("provider_event_id", providerEventId)
      .eq("claim_token", claimToken)
      .eq("processing_status", "processing")
      .select("id");
    if (finalizeError) throw finalizeError;
    if (!finalizedRows?.length) {
      return new Response(JSON.stringify({ status: "processing" }), { status: 503, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ status: "processed" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    await admin
      .from("webhook_events")
      .update({
        processing_status: "failed",
        processed_at: new Date().toISOString(),
        error_code: "processing_exception",
      })
      .eq("provider", "resend")
      .eq("provider_event_id", providerEventId)
      .eq("claim_token", claimToken)
      .eq("processing_status", "processing");

    return new Response(JSON.stringify({ error: "Processing failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
