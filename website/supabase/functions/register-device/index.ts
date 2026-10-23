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

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

serve(async (req: Request) => {
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
    // 1. Validate JWT and get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Missing or invalid authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Client with anon key for JWT validation
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Invalid or expired token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Parse request body
    const body: RegisterDeviceRequest = await req.json();
    if (!body.device_id || typeof body.device_id !== "string" || body.device_id.length < 8) {
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
      .select("plan_code, status, lifetime")
      .eq("user_id", user.id)
      .in("status", ["active", "lifetime_active"]);

    if (entError) {
      return new Response(JSON.stringify({ success: false, error: "Failed to check entitlements" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hasLifetime = entitlements?.some((e) => e.lifetime === true) ?? false;
    const hasMonthly = entitlements?.some((e) => e.plan_code === "monthly" && e.status === "active") ?? false;

    if (!hasLifetime && !hasMonthly) {
      return new Response(JSON.stringify({ success: false, error: "No active entitlement" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Check device limit (monthly: 3, lifetime: unlimited)
    if (!hasLifetime) {
      const { count, error: countError } = await supabaseAdmin
        .from("devices")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("revoked_at", null);

      if (countError) {
        return new Response(JSON.stringify({ success: false, error: "Failed to count devices" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const deviceCount = count ?? 0;
      if (deviceCount >= 3) {
        return new Response(JSON.stringify({
          success: false,
          device_id: body.device_id,
          device_count: deviceCount,
          limit_reached: true,
          error: "Device limit reached (max 3 for monthly plan)",
        }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 6. Register device (upsert for idempotency)
    const { error: upsertError } = await supabaseAdmin
      .from("devices")
      .upsert(
        {
          user_id: user.id,
          device_id: body.device_id,
          label: body.label || null,
          platform: body.platform || null,
          app_version: body.app_version || null,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "user_id,device_id" }
      );

    if (upsertError) {
      return new Response(JSON.stringify({ success: false, error: "Failed to register device" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 7. Get updated device count
    const { count: finalCount } = await supabaseAdmin
      .from("devices")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("revoked_at", null);

    const response: RegisterDeviceResponse = {
      success: true,
      device_id: body.device_id,
      device_count: finalCount ?? 1,
      limit_reached: false,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});