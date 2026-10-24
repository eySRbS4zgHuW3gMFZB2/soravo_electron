// Supabase Edge Function: Razorpay Order Creation
// Server-side only. Prices are never trusted from the client.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  monthly: { code: "monthly", amount: 1200, currency: "INR" },
  lifetime: { code: "lifetime", amount: 5000, currency: "INR" },
};

serve(async (req: Request) => {
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const client = createClient(supabaseUrl, anonKey);
    const { data: { user }, error: authError } = await client.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const planCode = typeof body?.plan_code === "string" ? body.plan_code : "";
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

    // Create Razorpay order server-side with trusted amount/plan.
    const basicAuth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
    const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: plan.amount,
        currency: plan.currency,
        receipt: `${plan.code}_${user.id}_${Date.now()}`,
        notes: {
          user_id: user.id,
          plan_code: plan.code,
        },
      }),
    });

    const rzpData = await rzpRes.json();
    if (!rzpRes.ok) {
      return new Response(JSON.stringify({ error: "Failed to create order", details: rzpData }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    await supabaseAdmin.from("payments").insert({
      user_id: user.id,
      provider: "razorpay",
      provider_payment_id: rzpData.id,
      amount_minor: plan.amount,
      currency: plan.currency,
      status: "pending",
    }).throwOnError();

    return new Response(JSON.stringify({
      key_id: razorpayKeyId,
      order_id: rzpData.id,
      amount: rzpData.amount,
      currency: rzpData.currency,
      plan_code: plan.code,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});