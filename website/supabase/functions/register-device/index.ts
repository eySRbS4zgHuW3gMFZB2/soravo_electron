// Supabase Edge Function: Device Registration
// Runtime: Deno
//
// Registers a device for the authenticated user. Enforces monthly device limits (max 3).
// Lifetime users have unlimited device registrations.
//
// POST /functions/v1/register-device
// Headers: Authorization: Bearer <jwt>
// Body: { device_id: string, label?: string, platform?: string, app_version?: string }
// Response: { success: boolean, device_id: string, device_count: number, limit_reached: boolean }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RegisterDeviceRequest {
  device_id: string;
  label?: string;
  platform?: string;
  app_version?: string;
}

interface RegisterDeviceResponse {
  success: boolean;
  device_id: string;
  device_count: number;
  limit_reached: boolean;
  error?: string;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // 1. Validate Bearer JWT and extract the token explicitly.
    //    We never rely on the client session; the token is derived from the
    //    validated Authorization header and passed directly to getUser().
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Missing or invalid authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.slice("Bearer ".length).trim();
    if (!token) {
      return new Response(JSON.stringify({ success: false, error: "Empty bearer token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      console.error("register-device: missing Supabase environment configuration");
      return new Response(JSON.stringify({ success: false, error: "Server misconfigured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Client with anon key for JWT validation. The token is passed explicitly.
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Invalid or expired token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Parse request body
    let body: RegisterDeviceRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ success: false, error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const optionalString = (value: unknown) => value == null || (typeof value === "string" && value.length <= 128);
    if (
      !body || typeof body !== "object" ||
      typeof body.device_id !== "string" || body.device_id.length < 8 || body.device_id.length > 128 ||
      !optionalString(body.label) || !optionalString(body.platform) || !optionalString(body.app_version)
    ) {
      return new Response(JSON.stringify({ success: false, error: "Invalid device_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Use service-role client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 4. Check user's entitlement (monthly vs lifetime)
    const { data: entitlements, error: entError } = await supabaseAdmin
      .from("entitlements")
      .select("plan_code, status, lifetime, subscription_period_end")
      .eq("user_id", user.id)
      .in("status", ["active", "lifetime_active"]);

    if (entError) {
      console.error("register-device: entitlement query failed", entError);
      return new Response(JSON.stringify({ success: false, error: "Failed to check entitlements" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hasLifetime = entitlements?.some((e) => e.lifetime === true) ?? false;
    const nowMs = Date.now();
    const hasMonthly = entitlements?.some((e) =>
      e.plan_code === "monthly" &&
      e.status === "active" &&
      (
        e.subscription_period_end == null ||
        new Date(e.subscription_period_end).getTime() > nowMs
      )
    ) ?? false;

    if (!hasLifetime && !hasMonthly) {
      return new Response(JSON.stringify({ success: false, error: "No active entitlement" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Register device atomically via a database function.
    //    The function takes a per-user advisory lock so concurrent requests for
    //    the same user serialize; the limit check and upsert happen in one
    //    transaction. Re-registering an already-ACTIVE device does not consume a
    //    slot. A REVOKED device is treated as new: it must pass the limit check
    //    before the function clears revoked_at.
    const { data: result, error: rpcError } = await supabaseAdmin.rpc(
      "register_device_atomic",
      {
        p_user_id: user.id,
        p_device_id: body.device_id,
        p_label: body.label || null,
        p_platform: body.platform || null,
        p_app_version: body.app_version || null,
        p_is_lifetime: hasLifetime,
      }
    );

    if (rpcError) {
      console.error("register-device: register_device_atomic RPC failed", rpcError);
      return new Response(JSON.stringify({ success: false, error: "Failed to register device" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!result.success) {
      return new Response(JSON.stringify({
        success: false,
        device_id: body.device_id,
        device_count: result.device_count,
        limit_reached: result.limit_reached,
        error: result.error,
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response: RegisterDeviceResponse = {
      success: true,
      device_id: body.device_id,
      device_count: result.device_count,
      limit_reached: false,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("register-device: unexpected handler failure", error);
    return new Response(JSON.stringify({ success: false, error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
