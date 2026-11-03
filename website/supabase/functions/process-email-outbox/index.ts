import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";
import {
  renderTemplate,
  RESEND_TIMEOUT_MS,
  sendResendEmail,
} from "../_shared/email.ts";
import { emailBackoffMs, MAX_EMAIL_ATTEMPTS } from "../_shared/email-outbox.ts";

interface OutboxRow {
  id: string;
  user_id: string | null;
  recipient_email: string;
  template_key: string;
  idempotency_key: string;
  status: string;
  attempt_count: number;
  metadata: Record<string, unknown> | null;
  claim_token: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const workerSecret =
    Deno.env.get("EMAIL_WORKER_SECRET") ?? Deno.env.get("CRON_SECRET");
  const acceptedSecret = workerSecret ?? serviceKey;
  const authHeader = req.headers.get("Authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const headerSecret = req.headers.get("x-email-worker-secret") ?? req.headers.get("x-worker-secret");
  const supplied = bearer || headerSecret || "";
  if (!acceptedSecret || supplied !== acceptedSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const requestedBatch = Number(Deno.env.get("EMAIL_BATCH_SIZE") ?? "25");
  const batchSize = Math.max(1, Math.min(Number.isFinite(requestedBatch) ? requestedBatch : 25, 100));
  const claimToken = crypto.randomUUID();

  const { data: claimedRows, error: claimError } = await admin.rpc("claim_email_outbox_batch", {
    p_batch_size: batchSize,
    p_claim_token: claimToken,
    // Give a full sequential batch time for each bounded provider request.
    p_lease_seconds: Math.ceil(batchSize * RESEND_TIMEOUT_MS / 1000) + 60,
  });

  if (claimError) {
    return new Response(JSON.stringify({ error: "Claim failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rows = Array.isArray(claimedRows) ? (claimedRows as OutboxRow[]) : [];
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!row.recipient_email || row.recipient_email === "[redacted]") {
      skipped += 1;
      await admin
        .from("email_outbox")
        .update({
          status: "failed_permanent",
          last_error_code: "redacted_recipient",
          next_attempt_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("claim_token", claimToken)
        .eq("status", "processing");
      continue;
    }

    // Final authorization immediately before the external provider request.
    // The external HTTP request is outside the database transaction; reread the
    // exact row and all authorization facts from the current database state.
    const finalCheckNow = new Date();
    const { data: authorizedRow, error: authorizationError } = await admin
      .from("email_outbox")
      .select("id, recipient_email, template_key, idempotency_key, metadata, status, claim_token, lease_expires_at")
      .eq("id", row.id)
      .eq("claim_token", claimToken)
      .eq("status", "processing")
      .gt("lease_expires_at", finalCheckNow.toISOString())
      .maybeSingle();

    if (
      authorizationError ||
      !authorizedRow ||
      !authorizedRow.recipient_email ||
      authorizedRow.recipient_email === "[redacted]"
    ) {
      if (!authorizationError && authorizedRow?.recipient_email === "[redacted]") {
        await admin
          .from("email_outbox")
          .update({
            status: "failed_permanent",
            last_error_code: "redacted_recipient",
            next_attempt_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id)
          .eq("claim_token", claimToken)
          .eq("status", "processing");
      }
      skipped += 1;
      continue;
    }

    // The database read and external HTTP request are not atomic. Renew the lease
    // only after the final read proves this worker still owns an unexpired claim.
    const leaseRenewalNow = new Date();
    const { data: renewedRows, error: renewalError } = await admin
      .from("email_outbox")
      .update({ lease_expires_at: new Date(leaseRenewalNow.getTime() + 60_000).toISOString() })
      .eq("id", row.id)
      .eq("claim_token", claimToken)
      .eq("status", "processing")
      .gt("lease_expires_at", leaseRenewalNow.toISOString())
      .select("id");
    if (renewalError || !renewedRows?.length) {
      skipped += 1;
      continue;
    }

    let rendered;
    try {
      rendered = renderTemplate(authorizedRow.template_key, authorizedRow.metadata ?? {});
    } catch {
      failed += 1;
      await admin
        .from("email_outbox")
        .update({
          status: "failed_permanent",
          last_error_code: "invalid_template",
          next_attempt_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("claim_token", claimToken)
        .eq("status", "processing");
      continue;
    }

    const result = await sendResendEmail({
      to: authorizedRow.recipient_email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      idempotencyKey: authorizedRow.idempotency_key,
    });

    if (result.ok) {
      const { error: updateError } = await admin
        .from("email_outbox")
        .update({
          status: "sent",
          provider_message_id: result.messageId ?? null,
          delivery_status: "sent",
          delivery_updated_at: new Date().toISOString(),
          last_error_code: null,
          next_attempt_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("claim_token", claimToken)
        .eq("status", "processing");
      if (updateError) {
        failed += 1;
      } else {
        sent += 1;
      }
    } else {
      failed += 1;
      const permanent =
        !result.retryable || row.attempt_count >= MAX_EMAIL_ATTEMPTS;
      const nextAttempt = permanent
        ? null
        : new Date(Date.now() + emailBackoffMs(row.attempt_count)).toISOString();
      await admin
        .from("email_outbox")
        .update({
          status: permanent ? "failed_permanent" : "failed_retryable",
          last_error_code: result.errorCode ?? "send_failed",
          next_attempt_at: nextAttempt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("claim_token", claimToken)
        .eq("status", "processing");
    }
  }

  return new Response(
    JSON.stringify({
      claimed: rows.length,
      sent,
      failed,
      skipped,
      batch_size: batchSize,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
