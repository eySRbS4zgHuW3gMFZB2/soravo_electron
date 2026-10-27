// Supabase Edge Function: Razorpay Webhook
// Verifies signatures over the exact raw body and provisions entitlements only for captured payments.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const encoder = new TextEncoder();

/** Encode each buffer byte as two lowercase hexadecimal characters. */
function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Sign the exact UTF-8 message with HMAC-SHA256 using the supplied secret.
 * @returns The signature encoded as lowercase hexadecimal.
 */
async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return toHex(signature);
}

/**
 * Compare trimmed, lowercase signatures, rejecting unequal lengths first.
 * Accumulate differences across every character when lengths match.
 */
function safeCompareHex(a: string, b: string): boolean {
  const normalizedA = a.trim().toLowerCase();
  const normalizedB = b.trim().toLowerCase();
  if (normalizedA.length !== normalizedB.length) return false;
  let diff = 0;
  for (let i = 0; i < normalizedA.length; i++) {
    diff |= normalizedA.charCodeAt(i) ^ normalizedB.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Map the currently supported USD amounts in minor units to plan codes.
 * @returns The matching plan, or null for an unsupported amount or currency.
 */
function derivePlan(amountMinor: number, currency: string): "monthly" | "lifetime" | null {
  if (currency !== "USD") return null;
  if (amountMinor === 1200) return "monthly";
  if (amountMinor === 5000) return "lifetime";
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
  if (!webhookSecret) {
    return new Response("Webhook not configured", { status: 503 });
  }

  const signature = req.headers.get("x-razorpay-signature");
  if (!signature) {
    return new Response("Missing signature", { status: 400 });
  }

  const rawBody = await req.text();
  const computed = await hmacSha256Hex(webhookSecret, rawBody);
  if (!safeCompareHex(computed, signature)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const eventType = typeof event?.event === "string" ? event.event : "unknown";
  const paymentEntity = event?.payload?.payment?.entity ?? null;
  const orderEntity = event?.payload?.order?.entity ?? null;
  const subscriptionEntity = event?.payload?.subscription?.entity ?? null;
  const entity = paymentEntity ?? orderEntity ?? subscriptionEntity ?? {};
  const providerSubscriptionId = String(
    entity?.subscription_id ??
      paymentEntity?.subscription_id ??
      subscriptionEntity?.id ??
      ""
  ).trim();

  const providerEventId =
    typeof event?.id === "string" && event.id.trim()
      ? event.id.trim()
      : `${eventType}:${entity?.id ?? "unknown-entity"}`;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  const admin = createClient(supabaseUrl, serviceKey);

  // Durable idempotency ledger. Duplicate means already handled.
  const { data: existing, error: existingError } = await admin
    .from("webhook_events")
    .select("id, processing_status")
    .eq("provider", "razorpay")
    .eq("provider_event_id", providerEventId)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing?.processing_status === "processed") {
    return new Response(JSON.stringify({ status: "duplicate" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!existing) {
    const { error: insertError } = await admin.from("webhook_events").insert({
      provider: "razorpay",
      provider_event_id: providerEventId,
      event_type: eventType,
      signature_valid: true,
      processing_status: "received",
    } as any);
    if (insertError) {
      // Likely a concurrent duplicate; fetch again and acknowledge if processed.
      const { data: retryExisting } = await admin
        .from("webhook_events")
        .select("id, processing_status")
        .eq("provider", "razorpay")
        .eq("provider_event_id", providerEventId)
        .maybeSingle();
      if (retryExisting?.processing_status === "processed") {
        return new Response(JSON.stringify({ status: "duplicate" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Could not record event" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // Atomically claim the event before provisioning entitlements.
  // Each acquisition replaces the previous worker's token, including failed retries.
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
    .eq("provider", "razorpay")
    .eq("provider_event_id", providerEventId)
    .in("processing_status", ["received", "failed"])
    .select("id");
  if (claimError) throw claimError;

  if (!claimedRows?.length) {
    ({ data: claimedRows, error: claimError } = await admin
      .from("webhook_events")
      .update({
        processing_status: "processing",
        claim_token: claimToken,
        claimed_at: claimNow,
        lease_expires_at: leaseUntil,
      })
      .eq("provider", "razorpay")
      .eq("provider_event_id", providerEventId)
      .eq("processing_status", "processing")
      .lt("lease_expires_at", claimNow)
      .select("id"));
    if (claimError) throw claimError;
  }

  if (!claimedRows?.length) {
    const { data: current } = await admin
      .from("webhook_events")
      .select("processing_status")
      .eq("provider", "razorpay")
      .eq("provider_event_id", providerEventId)
      .maybeSingle();
    if (current?.processing_status === "processed") {
      return new Response(JSON.stringify({ status: "duplicate" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ status: "processing" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // Only captured payments or paid orders with captured payments provision entitlements.
    const paymentStatus = String(entity?.status ?? "");
    const eventTypeLower = eventType.toLowerCase();
    const amountMinor = Number(entity?.amount ?? 0);
    const currency = String(entity?.currency ?? "");
    const orderId = String(entity?.order_id ?? entity?.id ?? "");
    let userId = String(
      entity?.notes?.user_id ??
        entity?.notes?.userId ??
        paymentEntity?.notes?.user_id ??
        paymentEntity?.notes?.userId ??
        subscriptionEntity?.notes?.user_id ??
        subscriptionEntity?.notes?.userId ??
        ""
    );
    if (!userId && entity?.order_id) {
      const { data: pendingPayment, error: pendingPaymentError } = await admin
        .from("payments")
        .select("user_id")
        .eq("provider", "razorpay")
        .eq("provider_order_id", String(entity.order_id))
        .eq("status", "pending")
        .maybeSingle();
      if (pendingPaymentError) throw pendingPaymentError;
      userId = String(pendingPayment?.user_id ?? "");
    }
    if (!userId && providerSubscriptionId) {
      const { data: subscriptionRow, error: subscriptionError } = await admin
        .from("subscriptions")
        .select("user_id")
        .eq("provider", "razorpay")
        .eq("provider_subscription_id", providerSubscriptionId)
        .maybeSingle();
      if (subscriptionError) throw subscriptionError;
      userId = String(subscriptionRow?.user_id ?? "");
    }
    if (!userId && providerSubscriptionId) {
      const { data: pendingSubscriptionPayment, error: pendingSubscriptionPaymentError } = await admin
        .from("payments")
        .select("user_id")
        .eq("provider", "razorpay")
        .eq("provider_subscription_id", providerSubscriptionId)
        .eq("status", "pending")
        .maybeSingle();
      if (pendingSubscriptionPaymentError) throw pendingSubscriptionPaymentError;
      userId = String(pendingSubscriptionPayment?.user_id ?? "");
    }
    const plan = derivePlan(amountMinor, currency);

    const isCapturedPaymentEvent =
      (eventTypeLower === "payment.captured" ||
        eventTypeLower === "subscription.charged" ||
        eventTypeLower === "subscription.authenticated") &&
      paymentStatus === "captured" &&
      amountMinor > 0;
    // order.paid is never sufficient evidence of capture on its own. Provisioning
    // happens only on explicit captured payment events; order.paid is acknowledged
    // without granting entitlements so a later payment.captured can complete it.
    const isPaidOrderWithCapturedPayment = false;

    if (!isCapturedPaymentEvent && !isPaidOrderWithCapturedPayment) {
      // Best-effort status reconciliation for failed/halted/cancelled subscription states.
      try {
        if (providerSubscriptionId) {
          let subscriptionStatus: string | null = subscriptionEntity?.status ? String(subscriptionEntity.status) : null;
          if (!subscriptionStatus) {
            if (eventTypeLower.includes("halted")) subscriptionStatus = "halted";
            else if (eventTypeLower.includes("pending")) subscriptionStatus = "pending";
            else if (eventTypeLower.includes("cancelled")) subscriptionStatus = "cancelled";
            else if (eventTypeLower.includes("paused")) subscriptionStatus = "paused";
            else if (eventTypeLower.includes("resumed") || eventTypeLower.includes("activated")) subscriptionStatus = "active";
            else if (eventTypeLower.includes("completed")) subscriptionStatus = "completed";
          }
          const eventCreatedAtUnix = Number(event?.created_at ?? entity?.created_at ?? 0);
          if (subscriptionStatus) {
            const { data: currentSub, error: currentSubError } = await admin
              .from("subscriptions")
              .select("last_event_created_at")
              .eq("provider", "razorpay")
              .eq("provider_subscription_id", providerSubscriptionId)
              .maybeSingle();
            if (currentSubError) throw currentSubError;
            const eventCreatedAt = eventCreatedAtUnix > 0
              ? new Date(eventCreatedAtUnix * 1000).toISOString()
              : null;
            const updatePayload: Record<string, unknown> = {
              status: subscriptionStatus,
              updated_at: new Date().toISOString(),
            };
            if (eventCreatedAt) updatePayload.last_event_created_at = eventCreatedAt;

            // The read is only a fast stale-event check. The UPDATE must also
            // enforce ordering against a newer event committed after the read.
            let updatedSubscriptions = null;
            if (!currentSub?.last_event_created_at ||
                (eventCreatedAt && eventCreatedAtUnix * 1000 >= new Date(currentSub.last_event_created_at).getTime())) {
              let statusUpdate = admin.from("subscriptions")
                .update(updatePayload)
                .eq("provider", "razorpay")
                .eq("provider_subscription_id", providerSubscriptionId);
              statusUpdate = eventCreatedAt
                ? statusUpdate.or(`last_event_created_at.is.null,last_event_created_at.lte.${eventCreatedAt}`)
                : statusUpdate.is("last_event_created_at", null);
              const { data, error: subscriptionStatusError } = await statusUpdate.select("id");
              if (subscriptionStatusError) throw subscriptionStatusError;
              updatedSubscriptions = data;
            }
            if (!updatedSubscriptions?.length) {
              const { data: staleRows, error: staleError } = await admin.from("webhook_events").update({
                processing_status: "processed",
                processed_at: new Date().toISOString(),
                error_code: "stale_event",
              }).eq("provider", "razorpay").eq("provider_event_id", providerEventId).eq("claim_token", claimToken).eq("processing_status", "processing").select("id");
              if (staleError) throw staleError;
              if (!staleRows?.length) {
                return new Response(JSON.stringify({ status: "processing" }), {
                  status: 503,
                  headers: { "Content-Type": "application/json", "Retry-After": "60" },
                });
              }
              return new Response(JSON.stringify({ status: "ignored", reason: "stale_event" }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
              });
            }
          }
        }
        if (eventTypeLower === "payment.failed" && entity?.id) {
          const failedUserId = userId || null;
          const failedAmount = Number(entity?.amount ?? amountMinor ?? 0);
          if (failedUserId && failedAmount > 0) {
            const { error: failedInsertError } = await admin.from("payments").insert({
              user_id: failedUserId,
              provider: "razorpay",
              provider_payment_id: String(entity.id),
              provider_order_id: entity?.order_id ? String(entity.order_id) : null,
              provider_subscription_id: providerSubscriptionId || null,
              amount_minor: failedAmount,
              currency: currency || "USD",
              status: "failed",
            } as Record<string, unknown>);
            if (failedInsertError && failedInsertError.code !== "23505") {
              console.error("razorpay-webhook: failed-payment insert failed", failedInsertError.code);
            }
          }
        }
      } catch (error) {
        throw error;
      }

      // Acknowledge authorization-only, failed, or unsupported events without granting entitlement.
      // A zero-row result means this worker no longer owns the claim; do not report success.
      const { data: ignoredRows, error: ignoredError } = await admin.from("webhook_events").update({
        processing_status: "processed",
        processed_at: new Date().toISOString(),
        error_code: "ignored_non_captured",
      })
        .eq("provider", "razorpay")
        .eq("provider_event_id", providerEventId)
        .eq("claim_token", claimToken)
        .eq("processing_status", "processing")
        .select("id");
      if (ignoredError) throw ignoredError;
      if (!ignoredRows?.length) {
        return new Response(JSON.stringify({ status: "processing" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ status: "ignored" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!userId || !plan) {
      const { data: invalidRows, error: invalidError } = await admin.from("webhook_events").update({
        processing_status: "failed",
        processed_at: new Date().toISOString(),
        error_code: "invalid_payload",
      })
        .eq("provider", "razorpay")
        .eq("provider_event_id", providerEventId)
        .eq("claim_token", claimToken)
        .eq("processing_status", "processing")
        .select("id");
      if (invalidError) throw invalidError;
      if (!invalidRows?.length) {
        return new Response(JSON.stringify({ status: "processing" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      }
      console.error("razorpay-webhook: invalid payload", providerEventId, eventType);
      return new Response(JSON.stringify({ status: "rejected", error: "Invalid payload" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Verify the user exists.
    const { data: profile, error: profileError } = await admin.from("profiles").select("user_id").eq("user_id", userId).maybeSingle();
    if (profileError) throw profileError;
    if (!profile) {
      const { data: unknownUserRows, error: unknownUserError } = await admin.from("webhook_events").update({
        processing_status: "failed",
        processed_at: new Date().toISOString(),
        error_code: "unknown_user",
      })
        .eq("provider", "razorpay")
        .eq("provider_event_id", providerEventId)
        .eq("claim_token", claimToken)
        .eq("processing_status", "processing")
        .select("id");
      if (unknownUserError) throw unknownUserError;
      if (!unknownUserRows?.length) {
        return new Response(JSON.stringify({ status: "processing" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      }
      console.error("razorpay-webhook: unknown user", providerEventId, eventType, userId);
      return new Response(JSON.stringify({ status: "rejected", error: "Unknown user" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Payment and entitlement provisioning now runs inside the claim-checked
    // finalize_webhook_payment_atomic RPC (one transaction). A worker that loses
    // its claim cannot commit business writes; finalization returns 0 and the
    // handler responds 503.
    // Atomically promote/record the payment, upsert the entitlement, and
    // finalize the event in one claim-checked transaction. A stale token
    // returns 0 and performs no business writes.
    let periodEnd: string | null = null;
    if (plan === "monthly") {
      const currentEndUnix = subscriptionEntity?.current_end ?? entity?.current_end;
      if (!currentEndUnix || Number.isNaN(Number(currentEndUnix))) {
        const { data: invalidRows } = await admin.from("webhook_events").update({
          processing_status: "failed",
          processed_at: new Date().toISOString(),
          error_code: "missing_period_end",
        }).eq("provider", "razorpay").eq("provider_event_id", providerEventId).eq("claim_token", claimToken).eq("processing_status", "processing").select("id");
        if (!invalidRows?.length) {
          return new Response(JSON.stringify({ status: "processing" }), {
            status: 503,
            headers: { "Content-Type": "application/json", "Retry-After": "60" },
          });
        }
        return new Response(JSON.stringify({ status: "rejected", error: "Missing provider period end" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      periodEnd = new Date(Number(currentEndUnix) * 1000).toISOString();
    }

    const { data: finalizedCount, error: finalizeError } = await admin.rpc(
      "finalize_webhook_payment_atomic",
      {
        p_provider: "razorpay",
        p_provider_event_id: providerEventId,
        p_claim_token: claimToken,
        p_user_id: userId,
        p_plan: plan,
        p_provider_payment_id: String(entity?.id ?? providerEventId),
        p_provider_order_id: orderId,
        p_amount_minor: amountMinor,
        p_currency: currency,
        p_period_end: periodEnd,
        p_lifetime: plan === "lifetime",
      }
    );
    if (finalizeError) throw finalizeError;
    if (!finalizedCount) {
      return new Response(JSON.stringify({ status: "processing" }), {
        status: 503,
        headers: { "Content-Type": "application/json", "Retry-After": "60" },
      });
    }

    // Reconcile recurring subscription metadata after a successful grant.
    try {
      if (providerSubscriptionId && plan === "monthly") {
        const grantEventCreatedAtUnix = Number(event?.created_at ?? entity?.created_at ?? 0);
        const subscriptionUpsertPayload: Record<string, unknown> = {
          user_id: userId,
          provider: "razorpay",
          provider_subscription_id: providerSubscriptionId,
          plan_code: "monthly",
          status: "active",
          current_period_end: periodEnd,
          updated_at: new Date().toISOString(),
        };
        if (grantEventCreatedAtUnix > 0) {
          subscriptionUpsertPayload.last_event_created_at = new Date(grantEventCreatedAtUnix * 1000).toISOString();
        }
        // Insert missing metadata without overwriting an existing subscription.
        const { error: subscriptionInsertError } = await admin.from("subscriptions")
          .insert(subscriptionUpsertPayload);
        if (subscriptionInsertError && subscriptionInsertError.code !== "23505") throw subscriptionInsertError;
        if (subscriptionInsertError) {
          let grantUpdate = admin.from("subscriptions")
            .update(subscriptionUpsertPayload)
            .eq("provider", "razorpay")
            .eq("provider_subscription_id", providerSubscriptionId);
          const grantEventCreatedAt = subscriptionUpsertPayload.last_event_created_at;
          grantUpdate = grantEventCreatedAt
            ? grantUpdate.or(`last_event_created_at.is.null,last_event_created_at.lte.${grantEventCreatedAt}`)
            : grantUpdate.is("last_event_created_at", null);
          const { data: updatedSubscriptions, error: grantUpdateError } = await grantUpdate.select("id");
          if (grantUpdateError) throw grantUpdateError;
          if (!updatedSubscriptions?.length) {
            // A late captured payment may extend the paid period, but cannot
            // reactivate a newer cancellation or move its watermark backward.
            const { error: periodUpdateError } = await admin.from("subscriptions")
              .update({ current_period_end: periodEnd })
              .eq("provider", "razorpay")
              .eq("provider_subscription_id", providerSubscriptionId)
              .or(`current_period_end.is.null,current_period_end.lt.${periodEnd}`);
            if (periodUpdateError) throw periodUpdateError;
          }
        }
      }
      if (entity?.id) {
        const { error: paymentUpdateError } = await admin.from("payments").update({
          provider_subscription_id: providerSubscriptionId || null,
        }).eq("provider", "razorpay").eq("provider_payment_id", String(entity.id));
        if (paymentUpdateError) console.error("razorpay-webhook: payment subscription link update failed", paymentUpdateError.code);
      }
    } catch (error) {
      console.error("razorpay-webhook: metadata reconciliation failed", (error as { code?: string })?.code);
      // Metadata reconciliation is secondary to the authoritative grant.
    }

    return new Response(JSON.stringify({ status: "processed" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // A zero-row update means this worker lost ownership after provisioning began.
    // In that case, do not mark the reclaimed event failed.
    const { data: failedRows, error: failedUpdateError } = await admin.from("webhook_events").update({
      processing_status: "failed",
      processed_at: new Date().toISOString(),
      error_code: "processing_exception",
    })
      .eq("provider", "razorpay")
      .eq("provider_event_id", providerEventId)
      .eq("claim_token", claimToken)
      .eq("processing_status", "processing")
      .select("id");
    if (!failedUpdateError && !failedRows?.length) {
      console.error("razorpay-webhook: processing exception", providerEventId, eventType);
      return new Response(JSON.stringify({ status: "processing" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }
    console.error("razorpay-webhook: processing failed", providerEventId, eventType);
    return new Response(JSON.stringify({ error: "Processing failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});