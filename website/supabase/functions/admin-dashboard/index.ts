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
    .is("revoked_at", null)
    .maybeSingle();
  if (roleError || !adminRow) return null;

  return { user, admin };
}

function safeSearch(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 120);
}

async function audit(adminClient: any, actorId: string, action: string, extra: Record<string, unknown> = {}) {
  await adminClient.from("admin_audit_events").insert({
    actor_user_id: actorId,
    action,
    target_type: "admin_dashboard",
    target_id: "dashboard",
    metadata: extra,
  });
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
      const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const [
        { count: totalUsers },
        { count: newUsers30d },
        { count: activeDevices },
        { count: totalDevices },
        { data: entitlements },
        { data: payments },
        { data: subscriptions },
        { data: webhookEvents },
        { data: profiles },
        { data: allDevices },
      ] = await Promise.all([
        admin.from("profiles").select("user_id", { count: "exact", head: true }),
        admin.from("profiles").select("user_id", { count: "exact", head: true }).gte("created_at", since30),
        admin.from("devices").select("id", { count: "exact", head: true }).is("revoked_at", null),
        admin.from("devices").select("id", { count: "exact", head: true }),
        admin.from("entitlements").select("plan_code, status, lifetime"),
        admin.from("payments").select("status, amount_minor, provider_subscription_id"),
        admin.from("subscriptions").select("status"),
        admin.from("webhook_events").select("processing_status"),
        admin.from("profiles").select("created_at"),
        admin.from("devices").select("user_id, revoked_at"),
      ]);

      const lifetimeEntitlements = (entitlements ?? []).filter(
        (e: any) => e.lifetime === true || e.status === "lifetime_active"
      ).length;
      const monthlyEntitlements = (entitlements ?? []).filter(
        (e: any) => e.plan_code === "monthly"
      ).length;

      let capturedTotal = 0;
      let capturedCount = 0;
      let failedPayments = 0;
      let refundedPayments = 0;
      let lifetimePaymentCount = 0;
      let recurringPaymentCount = 0;
      let lifetimePaymentTotalMinor = 0;
      let recurringPaymentTotalMinor = 0;
      for (const p of payments ?? []) {
        if (p.status === "captured") {
          capturedTotal += Number(p.amount_minor ?? 0);
          capturedCount += 1;
          if (p.provider_subscription_id) {
            recurringPaymentCount += 1;
            recurringPaymentTotalMinor += Number(p.amount_minor ?? 0);
          } else {
            lifetimePaymentCount += 1;
            lifetimePaymentTotalMinor += Number(p.amount_minor ?? 0);
          }
        } else if (p.status === "failed") failedPayments += 1;
        else if (p.status === "refunded") refundedPayments += 1;
      }

      const activeUserIds = new Set((allDevices ?? []).filter((d: any) => d.revoked_at === null).map((d: any) => d.user_id));

      const subscriptionBreakdown: Record<string, number> = {};
      for (const s of subscriptions ?? []) {
        subscriptionBreakdown[s.status] = (subscriptionBreakdown[s.status] ?? 0) + 1;
      }

      const webhookBreakdown: Record<string, number> = {};
      for (const w of webhookEvents ?? []) {
        webhookBreakdown[w.processing_status] = (webhookBreakdown[w.processing_status] ?? 0) + 1;
      }

      const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      const dayCounts = new Map<string, number>();
      for (const p of profiles ?? []) {
        const t = new Date(p.created_at).getTime();
        if (t < fourteenDaysAgo) continue;
        const key = new Date(p.created_at).toISOString().slice(0, 10);
        dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
      }
      const newUsersByDay = Array.from(dayCounts.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, count }));

      await audit(admin, user.id, "admin.overview.read", {});

      return json(200, {
        totalUsers: totalUsers ?? 0,
        newUsers30d: newUsers30d ?? 0,
        activeUsers: activeUserIds.size,
        activeDevices: activeDevices ?? 0,
        totalDevices: totalDevices ?? 0,
        lifetimeEntitlements,
        monthlyEntitlements,
        paymentTotalMinor: capturedTotal,
        capturedPayments: capturedCount,
        failedPayments,
        refundedPayments,
        totalPayments: (payments ?? []).length,
        lifetimePaymentCount,
        recurringPaymentCount,
        lifetimePaymentTotalMinor,
        recurringPaymentTotalMinor,
        subscriptionBreakdown,
        webhookBreakdown,
        newUsersByDay,
      });
    }

    if (action === "users") {
      const page = numberParam(body.page, 1, 1000);
      const pageSize = numberParam(body.pageSize, 25, 50);
      const q = safeSearch(body.q).toLowerCase();

      // Search must inspect all accounts, not just one page, so filtered
      // results cannot leak records across page boundaries.
      let allAuthUsers: any[] = [];\n      let authTotal: number | null = null;
      if (q) {
        const maxUsers = 5000;
        const perPage = 1000;
        for (let authPage = 1; authPage <= Math.ceil(maxUsers / perPage); authPage++) {
          const { data: usersResult, error: usersError } = await admin.auth.admin.listUsers({
            page: authPage,
            perPage,
          });
          if (usersError) return json(500, { error: "Failed to list users" });
          const batch = usersResult?.users ?? [];
          allAuthUsers = allAuthUsers.concat(batch);
          if (batch.length < perPage) break;
          if (allAuthUsers.length >= maxUsers) break;
        }
      } else {
        const { data: usersResult, error: usersError } = await admin.auth.admin.listUsers({
          page,
          perPage: pageSize,
        });
        if (usersError) return json(500, { error: "Failed to list users" });
        allAuthUsers = usersResult?.users ?? [];
        authTotal = usersResult?.total ?? allAuthUsers.length;
      }

      const ids = allAuthUsers.map((u: any) => u.id);
      const [{ data: profiles }, { data: entitlementRows }, { data: paymentRows }, { data: deviceRows }] = await Promise.all([
        ids.length ? admin.from("profiles").select("user_id, display_name, created_at").in("user_id", ids) : Promise.resolve({ data: [] }),
        ids.length ? admin.from("entitlements").select("user_id, plan_code, status, lifetime, subscription_period_end").in("user_id", ids) : Promise.resolve({ data: [] }),
        ids.length ? admin.from("payments").select("user_id, status, amount_minor").in("user_id", ids) : Promise.resolve({ data: [] }),
        ids.length ? admin.from("devices").select("user_id, id, revoked_at").in("user_id", ids) : Promise.resolve({ data: [] }),
      ]);

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

      const enriched = allAuthUsers.map((u: any) => ({
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

      const filtered = q
        ? enriched.filter((u: any) => (u.email ?? "").toLowerCase().includes(q) || (u.displayName ?? "").toLowerCase().includes(q))
        : enriched;

      // Paginate in memory for search; for direct listing we already fetched
      // only the requested page.
      const total = filtered.length;
      const start = q ? (page - 1) * pageSize : 0;
      const paged = q ? filtered.slice(start, start + pageSize) : filtered;

      await audit(admin, user.id, "admin.users.read", { page, q: q ? "provided" : "none", resultCount: paged.length });

      return json(200, {
        users: paged,
        page,
        pageSize,
        total: q ? total : (authTotal ?? allAuthUsers.length),
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
      const { data: usersResult } = userIds.length
        ? await admin.auth.admin.listUsers({ perPage: 1000 })
        : { data: { users: [] } };
      const emailMap = new Map((usersResult?.users ?? []).map((u: any) => [u.id, u.email]));
      const payments = (paymentRows ?? []).map((p: any) => ({
        ...p,
        userEmail: emailMap.get(p.user_id) ?? null,
      }));

      await audit(admin, user.id, "admin.payments.read", { page, resultCount: payments.length });
      return json(200, { payments, page, pageSize, total: count ?? payments.length });
    }

    if (action === "subscriptions") {
      const { data: subs, error } = await admin
        .from("subscriptions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) return json(500, { error: "Failed to list subscriptions" });

      const userIds = Array.from(new Set((subs ?? []).map((s: any) => s.user_id)));
      const { data: usersResult } = userIds.length
        ? await admin.auth.admin.listUsers({ perPage: 1000 })
        : { data: { users: [] } };
      const emailMap = new Map((usersResult?.users ?? []).map((u: any) => [u.id, u.email]));
      const subscriptions = (subs ?? []).map((s: any) => ({
        ...s,
        userEmail: emailMap.get(s.user_id) ?? null,
      }));
      await audit(admin, user.id, "admin.subscriptions.read", { resultCount: subscriptions.length });
      return json(200, { subscriptions });
    }

    if (action === "devices") {
      const { data: devices, error } = await admin
        .from("devices")
        .select("*")
        .order("last_seen_at", { ascending: false })
        .limit(100);
      if (error) return json(500, { error: "Failed to list devices" });

      const userIds = Array.from(new Set((devices ?? []).map((d: any) => d.user_id)));
      const { data: usersResult } = userIds.length
        ? await admin.auth.admin.listUsers({ perPage: 1000 })
        : { data: { users: [] } };
      const emailMap = new Map((usersResult?.users ?? []).map((u: any) => [u.id, u.email]));
      const devices = (devices ?? []).map((d: any) => ({
        ...d,
        userEmail: emailMap.get(d.user_id) ?? null,
      }));
      await audit(admin, user.id, "admin.devices.read", { resultCount: devices.length });
      return json(200, { devices });
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
      const { data: usersResult } = actorIds.length
        ? await admin.auth.admin.listUsers({ perPage: 1000 })
        : { data: { users: [] } };
      const emailMap = new Map((usersResult?.users ?? []).map((u: any) => [u.id, u.email]));
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