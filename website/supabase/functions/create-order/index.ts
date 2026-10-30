// Supabase Edge Function: Razorpay checkout creation
// Server-side only. Prices are never trusted from the client.
// Monthly uses Razorpay Subscriptions (genuinely recurring); lifetime uses a
// normal one-time Razorpay order.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Plan {
  code: "monthly" | "lifetime";
  amount: number; // minor units
  currency: string;
}

// Trusted plan configuration. Never accept amounts from the client.
const PLANS: Record<string, Plan> = {
  monthly: { code: "monthly", amount: 1200, currency: "USD" },
  lifetime: { code: "lifetime", amount: 5000, currency: "USD" },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.slice(7).trim();

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return new Response(JSON.stringify({ error: "Server misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const client = createClient(supabaseUrl, anonKey);
    const { data: { user }, error: authError } = await client.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let body: { plan_code?: unknown };
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!body || typeof body !== "object") {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const planCode = typeof body.plan_code === "string" ? body.plan_code : "";
    const plan = PLANS[planCode];
    if (!plan) {
      return new Response(JSON.stringify({ error: "Invalid plan" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!razorpayKeyId || !razorpayKeySecret) {
      return new Response(JSON.stringify({ error: "Razorpay not configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const basicAuth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: currentEntitlements, error: currentEntitlementError } = await admin
      .from("entitlements")
      .select("plan_code, status, subscription_period_end")
      .eq("user_id", user.id);
    if (currentEntitlementError) throw currentEntitlementError;
    const ownsLifetime = (currentEntitlements ?? []).some((row) =>
      row.plan_code === "lifetime" &&
      ["lifetime_active", "active"].includes(String(row.status).toLowerCase())
    );
    const ownsActiveMonthly = (currentEntitlements ?? []).some((row) => {
      if (row.plan_code !== "monthly" || String(row.status).toLowerCase() !== "active") return false;
      if (!row.subscription_period_end) return true;
      return new Date(row.subscription_period_end).getTime() > Date.now();
    });
    if (ownsLifetime) {
      return new Response(JSON.stringify({ error: "Lifetime access is already active on this account" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (plan.code === "monthly" && ownsActiveMonthly) {
      return new Response(JSON.stringify({ error: "Monthly subscription is already active on this account" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (plan.code === "lifetime") {
      const requestId = crypto.randomUUID();
      const { data: checkout, error: checkoutError } = await admin.rpc("claim_lifetime_checkout", {
        p_user_id: user.id,
        p_request_id: requestId,
      });
      if (checkoutError) {
        console.error("create-order: lifetime checkout claim failed", checkoutError.code, requestId);
        return new Response(JSON.stringify({ error: "Failed to check lifetime checkout" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (checkout?.status === "blocked" || checkout?.status === "busy") {
        return new Response(JSON.stringify({ error: checkout.error }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (checkout?.status === "reuse") {
        return new Response(JSON.stringify({
          key_id: razorpayKeyId,
          order_id: checkout.order_id,
          amount: plan.amount,
          currency: plan.currency,
          plan_code: plan.code,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (checkout?.status !== "claimed") throw new Error("Unexpected checkout claim result");

      // Retain ambiguous outcomes for reconciliation, just as monthly checkout does.
      let providerOutcomeUncertain = true;
      try {
        const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
          method: "POST",
          headers: {
            Authorization: `Basic ${basicAuth}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: plan.amount,
            currency: plan.currency,
            receipt: `rcpt_${crypto.randomUUID().replace(/-/g, "").slice(0, 32)}`,
            notes: {
              user_id: user.id,
              plan_code: plan.code,
              checkout_request_id: requestId,
            },
          }),
        });
        if (rzpRes.status >= 400 && rzpRes.status < 500 && rzpRes.status !== 408) {
          providerOutcomeUncertain = false;
        }
        const rzpData = await rzpRes.json().catch(() => null);
        if (!rzpRes.ok || !rzpData?.id) {
          console.error("create-order: Razorpay order creation failed", rzpRes.status, rzpData?.error?.code, requestId);
          return new Response(JSON.stringify({ error: "Failed to create order" }), {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await admin.from("payments").insert({
          user_id: user.id,
          provider: "razorpay",
          provider_payment_id: String(rzpData.id),
          provider_order_id: rzpData.id,
          provider_subscription_id: null,
          amount_minor: plan.amount,
          currency: plan.currency,
          status: "pending",
        }).throwOnError();
        providerOutcomeUncertain = false;

        return new Response(JSON.stringify({
          key_id: razorpayKeyId,
          order_id: rzpData.id,
          amount: plan.amount,
          currency: plan.currency,
          plan_code: plan.code,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } finally {
        if (!providerOutcomeUncertain) {
          const { error: releaseError } = await admin.from("lifetime_checkout_reservations")
            .delete().eq("user_id", user.id).eq("request_id", requestId);
          if (releaseError) console.error("create-order: checkout reservation release failed", releaseError.code, requestId);
        }
      }
    }

    // Correlation ID for billing diagnostics.
    const requestId = crypto.randomUUID();

    // Reserve before any provider call. The database checks entitlements and
    // open subscriptions while serializing checkout requests for this user.
    const { data: checkout, error: checkoutError } = await admin.rpc("claim_monthly_checkout", {
      p_user_id: user.id,
      p_request_id: requestId,
    });
    if (checkoutError) {
      return new Response(JSON.stringify({ error: "Failed to check monthly checkout" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (checkout?.status === "blocked" || checkout?.status === "busy") {
      return new Response(JSON.stringify({ error: checkout.error }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (checkout?.status === "reuse") {
      return new Response(JSON.stringify({
        key_id: razorpayKeyId,
        subscription_id: checkout.subscription_id,
        amount: plan.amount,
        currency: plan.currency,
        plan_code: "monthly",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (checkout?.status !== "claimed") throw new Error("Unexpected checkout claim result");

    let providerOutcomeUncertain = false;
    try {
      // Monthly recurring subscription. Reuse or create the trusted plan idempotently.
      let monthlyPlanId: string | null = null;
      const { data: existingPlan, error: planLookupError } = await admin
        .from("razorpay_plans")
        .select("provider_plan_id")
        .eq("provider", "razorpay")
        .eq("plan_code", "monthly")
        .eq("amount_minor", plan.amount)
        .eq("currency", plan.currency)
        .maybeSingle();
      if (planLookupError) {
        console.error("create-order: razorpay_plans lookup failed", planLookupError.code, requestId);
        return new Response(JSON.stringify({ error: "Failed to resolve subscription plan" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (existingPlan?.provider_plan_id) {
        monthlyPlanId = String(existingPlan.provider_plan_id);
      } else {
        const planRes = await fetch("https://api.razorpay.com/v1/plans", {
          method: "POST",
          headers: {
            Authorization: `Basic ${basicAuth}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            period: "monthly",
            interval: 1,
            item: {
              name: "Soravo Monthly",
              amount: plan.amount,
              currency: plan.currency,
              description: "Soravo monthly subscription",
            },
            notes: {
              plan_code: "monthly",
            },
          }),
        });
        const planData = await planRes.json().catch(() => null);
        if (!planRes.ok || !planData?.id) {
          console.error("create-order: Razorpay plan creation failed", planRes.status, JSON.stringify(planData));
          return new Response(JSON.stringify({
            error: "Failed to create subscription plan",
            provider_status: planRes.status,
            provider_error_code: planData?.error?.code ?? null,
            provider_error_description: planData?.error?.description ?? null,
            provider_error_reason: planData?.error?.reason ?? null,
          }), {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        monthlyPlanId = String(planData.id);
        try {
          const { error: insertError } = await admin.from("razorpay_plans").insert({
            provider: "razorpay",
            plan_code: "monthly",
            amount_minor: plan.amount,
            currency: plan.currency,
            period: "monthly",
            interval: 1,
            provider_plan_id: monthlyPlanId,
          });
          if (insertError && insertError.code !== "23505") {
            console.error("create-order: razorpay_plans insert failed", insertError.code, requestId);
          }
          if (insertError) {
            // A concurrent request may have created it; reuse that row.
            const { data: retryPlan, error: retryLookupError } = await admin
              .from("razorpay_plans")
              .select("provider_plan_id")
              .eq("provider", "razorpay")
              .eq("plan_code", "monthly")
              .eq("amount_minor", plan.amount)
              .eq("currency", plan.currency)
              .maybeSingle();
            if (retryLookupError) {
              console.error("create-order: razorpay_plans retry lookup failed", retryLookupError.code, requestId);
              return new Response(JSON.stringify({ error: "Failed to resolve subscription plan" }), {
                status: 502,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              });
            }
            if (retryPlan?.provider_plan_id) monthlyPlanId = String(retryPlan.provider_plan_id);
          }
        } catch {
          const { data: retryPlan, error: retryLookupError } = await admin
            .from("razorpay_plans")
            .select("provider_plan_id")
            .eq("provider", "razorpay")
            .eq("plan_code", "monthly")
            .eq("amount_minor", plan.amount)
            .eq("currency", plan.currency)
            .maybeSingle();
          if (retryLookupError) {
            console.error("create-order: razorpay_plans retry lookup failed", retryLookupError.code, requestId);
            return new Response(JSON.stringify({ error: "Failed to resolve subscription plan" }), {
              status: 502,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          if (retryPlan?.provider_plan_id) monthlyPlanId = String(retryPlan.provider_plan_id);
        }
      }

      if (!monthlyPlanId) {
        return new Response(JSON.stringify({ error: "Failed to resolve subscription plan" }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // An uncertain provider outcome must retain the reservation: retrying a
      // timed-out create could produce a second billable subscription.
      providerOutcomeUncertain = true;
      const subscriptionRes = await fetch("https://api.razorpay.com/v1/subscriptions", {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plan_id: monthlyPlanId,
          total_count: 120,
          quantity: 1,
          customer_notify: true,
          notes: {
            user_id: user.id,
            plan_code: "monthly",
            checkout_request_id: requestId,
          },
        }),
      });

      // A definitive rejection did not create a subscription and can be retried.
      if (subscriptionRes.status >= 400 && subscriptionRes.status < 500 && subscriptionRes.status !== 408) {
        providerOutcomeUncertain = false;
      }
      const subscriptionData = await subscriptionRes.json().catch(() => null);
      if (!subscriptionRes.ok || !subscriptionData?.id) {
        console.error("create-order: Razorpay subscription creation failed", subscriptionRes.status, subscriptionData?.error?.code, requestId);
        return new Response(JSON.stringify({
          error: "Failed to create subscription",
          provider_status: subscriptionRes.status,
          provider_error_code: subscriptionData?.error?.code ?? null,
          provider_error_description: subscriptionData?.error?.description ?? null,
          provider_error_reason: subscriptionData?.error?.reason ?? null,
        }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: subSaveError } = await admin.from("subscriptions").upsert({
        user_id: user.id,
        provider: "razorpay",
        provider_subscription_id: String(subscriptionData.id),
        plan_code: "monthly",
        status: String(subscriptionData.status ?? "created"),
        total_count: Number(subscriptionData.total_count ?? 120),
        paid_count: Number(subscriptionData.paid_count ?? 0),
        charge_at: subscriptionData.charge_at ? new Date(Number(subscriptionData.charge_at) * 1000).toISOString() : null,
        current_period_end: subscriptionData.current_end ? new Date(Number(subscriptionData.current_end) * 1000).toISOString() : null,
        // Provider event time is set only by webhooks, never the local clock.
      }, { onConflict: "provider_subscription_id", ignoreDuplicates: true });
      if (subSaveError) {
        if (subSaveError.code !== "23505") {
          const cancelController = new AbortController();
          const cancelTimeout = setTimeout(() => cancelController.abort(), 5_000);
          try {
            const cancelRes = await fetch(`https://api.razorpay.com/v1/subscriptions/${encodeURIComponent(String(subscriptionData.id))}/cancel`, {
              method: "POST",
              signal: cancelController.signal,
              headers: {
                Authorization: `Basic ${basicAuth}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ cancel_at_cycle_end: 0 }),
            });
            if (!cancelRes.ok) console.error("create-order: subscription cancellation failed", cancelRes.status, requestId);
          } catch {
            console.error("create-order: subscription cancellation failed", requestId);
          } finally {
            clearTimeout(cancelTimeout);
          }
          // Keep the reservation until the failed save/provider state is reconciled.
          throw subSaveError;
        }
        // Also handle overlapping legacy workers that did not reserve first.
        // The just-created provider outcome remains reserved for reconciliation.
        const { data: existingAfterRace, error: raceLookupError } = await admin
          .from("subscriptions")
          .select("provider_subscription_id, status")
          .eq("user_id", user.id)
          .eq("provider", "razorpay")
          .in("status", ["created", "authenticated", "active", "pending", "resumed"])
          .limit(1)
          .maybeSingle();
        if (raceLookupError) {
          return new Response(JSON.stringify({ error: "Failed to check existing subscriptions" }), {
            status: 502,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (!existingAfterRace) throw subSaveError;
        if (existingAfterRace.status !== "created") {
          return new Response(JSON.stringify({ error: "Monthly subscription already active" }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({
          key_id: razorpayKeyId,
          subscription_id: existingAfterRace.provider_subscription_id,
          amount: plan.amount,
          currency: plan.currency,
          plan_code: plan.code,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      providerOutcomeUncertain = false;

      return new Response(JSON.stringify({
        key_id: razorpayKeyId,
        subscription_id: subscriptionData.id,
        amount: plan.amount,
        currency: plan.currency,
        plan_code: plan.code,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } finally {
      if (!providerOutcomeUncertain) {
        const { error: releaseError } = await admin.from("monthly_checkout_reservations")
          .delete().eq("user_id", user.id).eq("request_id", requestId);
        if (releaseError) console.error("create-order: checkout reservation release failed", releaseError.code, requestId);
      }
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
