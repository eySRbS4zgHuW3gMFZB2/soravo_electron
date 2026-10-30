import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action = "overview" | "users" | "payments" | "subscriptions" | "devices" | "audit";

interface RequestBody {
  action?: unknown;
  page?: unknown;
  pageSize?: unknown;
  q?: unknown;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function numberParam(value: unknown, fallback: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), max);
}

/** Authenticate the caller and verify the server-side admin role. */
async function authenticateAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) return null;

  const browser = createClient(supabaseUrl, anonKey);
  const { data: { user }, error: authError } = await browser.auth.getUser(token);
  if (authError || !user) return null;

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: adminRow, error: roleError } = await admin
    .from("admin_users")
    .select("user_id, role")
    .eq("user_id", user.id)
    .eq("role", "owner")
    .is("revoked_at", null)
    .maybeSingle();
  if (roleError || !adminRow) return null;

  return { user, admin };
}

function safeSearch(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 120);
}

async function emailsFor(admin: any, ids: string[]): Promise<Map<string, string | null>> {
  const entries = await Promise.all(
    ids.map(async (id) => {
      const { data, error } = await admin.auth.admin.getUserById(id);
      if (error) throw error;
      return [id, data?.user?.email ?? null] as const;
    })
  );
  return new Map(entries);
}

async function audit(adminClient: any, actorId: string, action: string, extra: Record<string, unknown> = {}) {
  const { error } = await adminClient.from("admin_audit_events").insert({
    actor_user_id: actorId,
    action,
    target_type: "admin_dashboard",
    target_id: "dashboard",
    metadata: extra,
  });
  // Privileged dashboard reads are fail-closed: if the audit trail cannot be
  // written, the response is not returned. Missing security-relevant evidence
  // is treated as an access failure rather than a best-effort log.
  if (error) throw new Error("Admin audit logging failed");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  let body: RequestBody;
  try {
    body = (await req.json()) ?? {};
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const auth = await authenticateAdmin(req);
  if (!auth) return json(403, { error: "Admin access denied" });
  const { user, admin } = auth;

  const action = typeof body.action === "string" ? (body.action as Action) : undefined;
  if (!action || !["overview", "users", "payments", "subscriptions", "devices", "audit"].includes(action)) {
    return json(400, { error: "Invalid action" });
  }

  try {
    if (action === "overview") {
      // Aggregate in PostgreSQL so PostgREST's row limit cannot truncate metrics.
      // Overview is atomic: any query failure returns an error, never partial zeros.
      const { data: overview, error } = await admin.rpc("admin_dashboard_overview");
      if (error || !overview) return json(500, { error: "Failed to load admin overview" });

      await audit(admin, user.id, "admin.overview.read", {});
      return json(200, overview);
    }

    if (action === "users") {
      const page = numberParam(body.page, 1, 1000);
      const pageSize = numberParam(body.pageSize, 25, 50);
      const q = safeSearch(body.q).toLowerCase();

      let pageAuthUsers: any[];
      let total: number;
      if (q) {
        const { data, error } = await admin.rpc("admin_dashboard_search_users", {
          search_text: q, page_number: page, page_size: pageSize,
        });
        if (error || !data) return json(500, { error: "Failed to search users" });
        pageAuthUsers = data.users;
        total = data.total;
      } else {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage: pageSize });
        if (error) return json(500, { error: "Failed to list users" });
        pageAuthUsers = data?.users ?? [];
        const reportedTotal = data?.total ?? 0;
        total =
          reportedTotal > 0
            ? reportedTotal
            : page * pageSize + (pageAuthUsers.length === pageSize ? 1 : 0);
      }

      const ids = pageAuthUsers.map((u: any) => u.id);

      const [{ data: profiles, error: profilesError }, { data: entitlementRows, error: entitlementsError }, { data: paymentRows, error: paymentsError }, { data: deviceRows, error: deviceRowsError }] = await Promise.all([
        ids.length ? admin.from("profiles").select("user_id, display_name, created_at").in("user_id", ids) : Promise.resolve({ data: [], error: null }),
        ids.length ? admin.from("entitlements").select("user_id, plan_code, status, lifetime, subscription_period_end").in("user_id", ids) : Promise.resolve({ data: [], error: null }),
        ids.length ? admin.from("payments").select("user_id, status, amount_minor").in("user_id", ids) : Promise.resolve({ data: [], error: null }),
        ids.length ? admin.from("devices").select("user_id, id, revoked_at").in("user_id", ids) : Promise.resolve({ data: [], error: null }),
      ]);

      if (profilesError || entitlementsError || paymentsError || deviceRowsError) {
        return json(500, { error: "Failed to load admin users" });
      }

      const profileMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
      const entMap = new Map();
      for (const e of entitlementRows ?? []) {
        entMap.set(e.user_id, [...(entMap.get(e.user_id) ?? []), e]);
      }
      const paymentsByUser = new Map<string, { captured: number; total: number }>();
      for (const p of paymentRows ?? []) {
        const cur = paymentsByUser.get(p.user_id) ?? { captured: 0, total: 0 };
        cur.total += 1;
        if (p.status === "captured") cur.captured += 1;
        paymentsByUser.set(p.user_id, cur);
      }
      const devicesByUser = new Map<string, { active: number; total: number }>();
      for (const d of deviceRows ?? []) {
        const cur = devicesByUser.get(d.user_id) ?? { active: 0, total: 0 };
        cur.total += 1;
        if (d.revoked_at === null) cur.active += 1;
        devicesByUser.set(d.user_id, cur);
      }

      const enriched = pageAuthUsers.map((u: any) => ({
        userId: u.id,
        email: u.email ?? null,
        signupDate: u.created_at ?? profileMap.get(u.id)?.created_at ?? null,
        emailConfirmedAt: u.email_confirmed_at ?? null,
        bannedUntil: u.banned_until ?? null,
        displayName: profileMap.get(u.id)?.display_name ?? null,
        entitlements: entMap.get(u.id) ?? [],
        payments: paymentsByUser.get(u.id) ?? { captured: 0, total: 0 },
        devices: devicesByUser.get(u.id) ?? { active: 0, total: 0 },
      }));

      await audit(admin, user.id, "admin.users.read", { page, q: q ? "provided" : "none", resultCount: enriched.length });

      return json(200, {
        users: enriched,
        page,
        pageSize,
        total,
      });
    }

    if (action === "payments") {
      const page = numberParam(body.page, 1, 1000);
      const pageSize = numberParam(body.pageSize, 25, 50);
      const from = (page - 1) * pageSize;
      const { data: paymentRows, error, count } = await admin
        .from("payments")
        .select("id, user_id, provider, provider_payment_id, provider_order_id, amount_minor, currency, status, created_at, verified_at, refund_state", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) return json(500, { error: "Failed to list payments" });

      const userIds = Array.from(new Set((paymentRows ?? []).map((p: any) => p.user_id)));
      const emailMap = userIds.length ? await emailsFor(admin, userIds) : new Map();
      const payments = (paymentRows ?? []).map((p: any) => ({
        ...p,
        userEmail: emailMap.get(p.user_id) ?? null,
      }));

      await audit(admin, user.id, "admin.payments.read", { page, resultCount: payments.length });
      return json(200, { payments, page, pageSize, total: count ?? payments.length });
    }

    if (action === "subscriptions") {
      const page = numberParam(body.page, 1, 1000);
      const pageSize = numberParam(body.pageSize, 25, 50);
      const from = (page - 1) * pageSize;
      const { data: subs, error, count } = await admin
        .from("subscriptions")
        .select("id, user_id, provider, provider_subscription_id, plan_code, status, current_period_start, current_period_end, paid_count, total_count, charge_at, ended_at, created_at, updated_at, last_event_created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) return json(500, { error: "Failed to list subscriptions" });

      const userIds = Array.from(new Set((subs ?? []).map((s: any) => s.user_id)));
      const emailMap = userIds.length ? await emailsFor(admin, userIds) : new Map();
      const subscriptions = (subs ?? []).map((s: any) => ({
        ...s,
        userEmail: emailMap.get(s.user_id) ?? null,
      }));
      await audit(admin, user.id, "admin.subscriptions.read", { page, resultCount: subscriptions.length });
      return json(200, { subscriptions, page, pageSize, total: count ?? subscriptions.length });
    }

    if (action === "devices") {
      const page = numberParam(body.page, 1, 1000);
      const pageSize = numberParam(body.pageSize, 25, 50);
      const from = (page - 1) * pageSize;
      const { data: deviceRows, error, count } = await admin
        .from("devices")
        .select("id, user_id, device_id, label, platform, app_version, first_seen_at, last_seen_at, revoked_at", { count: "exact" })
        .order("last_seen_at", { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) return json(500, { error: "Failed to list devices" });

      const userIds = Array.from(new Set((deviceRows ?? []).map((d: any) => d.user_id)));
      const emailMap = userIds.length ? await emailsFor(admin, userIds) : new Map();
      const devices = (deviceRows ?? []).map((d: any) => ({
        id: d.id,
        user_id: d.user_id,
        userEmail: emailMap.get(d.user_id) ?? null,
        device_id: d.device_id,
        label: d.label,
        platform: d.platform,
        app_version: d.app_version,
        first_seen_at: d.first_seen_at,
        last_seen_at: d.last_seen_at,
        revoked_at: d.revoked_at,
      }));
      await audit(admin, user.id, "admin.devices.read", { page, resultCount: devices.length });
      return json(200, { devices, page, pageSize, total: count ?? devices.length });
    }

    if (action === "audit") {
      const page = numberParam(body.page, 1, 1000);
      const pageSize = numberParam(body.pageSize, 25, 50);
      const from = (page - 1) * pageSize;
      const { data: events, error, count } = await admin
        .from("admin_audit_events")
        .select("id, actor_user_id, action, target_type, target_id, reason, metadata, created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);
      if (error) return json(500, { error: "Failed to list audit events" });

      const actorIds = Array.from(new Set((events ?? []).map((e: any) => e.actor_user_id).filter(Boolean)));
      const emailMap = actorIds.length ? await emailsFor(admin, actorIds) : new Map();
      const auditEvents = (events ?? []).map((e: any) => ({
        ...e,
        actorEmail: emailMap.get(e.actor_user_id) ?? null,
      }));

      await audit(admin, user.id, "admin.audit.read", { page, resultCount: auditEvents.length });
      return json(200, { events: auditEvents, page, pageSize, total: count ?? auditEvents.length });
    }

    return json(400, { error: "Invalid action" });
  } catch (error) {
    console.error("admin-dashboard: unexpected failure", action);
    return json(500, { error: "Internal server error" });
  }
});