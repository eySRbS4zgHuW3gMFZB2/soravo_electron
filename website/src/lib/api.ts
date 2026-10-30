import { supabase } from "./supabase";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co";

export interface DeviceRegistrationResult {
  success: boolean;
  device_id: string;
  device_count: number;
  limit_reached: boolean;
  error?: string;
}

/**
 * Register or refresh a device through the Edge Function using the current session.
 *
 * @param deviceId - Device identifier included in the registration request.
 * @param label - Optional display name for the device.
 * @param platform - Optional operating system name.
 * @param appVersion - Optional desktop application version.
 * @returns The server's registration result, or a failure result when signed out.
 * @throws If the network request fails or the response cannot be parsed as JSON.
 */
export async function registerDevice(
  deviceId: string,
  label?: string,
  platform?: string,
  appVersion?: string
): Promise<DeviceRegistrationResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return { success: false, device_id: deviceId, device_count: 0, limit_reached: false, error: "Not authenticated" };
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/register-device`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      device_id: deviceId,
      label,
      platform,
      app_version: appVersion,
    }),
  });

  return response.json();
}

/**
 * List non-revoked devices visible under RLS, ordered by most recent activity.
 *
 * @returns The device records, or an empty array when none are returned.
 * @throws If the caller is not authenticated or the database query fails.
 */
export async function listDevices(): Promise<{ id: string; device_id: string; label: string | null; platform: string | null; last_seen_at: string }[]> {
  // Ensure the caller is authenticated before listing devices.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("devices")
    .select("id, device_id, label, platform, last_seen_at")
    .is("revoked_at", null)
    .order("last_seen_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Mark a device belonging to the current user as revoked.
 *
 * @param deviceId - Device identifier to revoke within the current user's account.
 * @throws If the caller is not authenticated or the database update fails.
 */
export async function revokeDevice(deviceId: string): Promise<void> {
  // Get current user to ensure ownership
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("devices")
    .update({ revoked_at: new Date().toISOString() })
    .eq("device_id", deviceId)
    .eq("user_id", user.id);

  if (error) throw error;
}

export type PlanCode = "monthly" | "lifetime";

export interface CreateOrderResult {
  key_id: string;
  order_id?: string;
  subscription_id?: string;
  amount: number;
  currency: string;
  plan_code: PlanCode;
  error?: string;
}

const SUPPORTED_PLANS: PlanCode[] = ["monthly", "lifetime"];

/**
 * Create a Razorpay order through the trusted Edge Function. The amount is
 * determined server-side; the client only supplies the plan code.
 */
export async function createOrder(planCode: PlanCode): Promise<CreateOrderResult> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("Not authenticated");
  }
  if (!SUPPORTED_PLANS.includes(planCode)) {
    throw new Error("Invalid plan");
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/create-order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ plan_code: planCode }),
  });

  const data = (await response.json().catch(() => null)) as CreateOrderResult | null;
  if (!response.ok || !data) {
    throw new Error(data?.error ?? "Failed to create order");
  }
  return data;
}


/**
 * Read the signed-in user's entitlements through RLS.
 */

const SUPABASE_FUNCTIONS = `${SUPABASE_URL}/functions/v1`;

export async function listEntitlements(): Promise<
  { plan_code: string; status: string; lifetime: boolean; subscription_period_end: string | null }[]
> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("entitlements")
    .select("plan_code, status, lifetime, subscription_period_end")
    .eq("user_id", user.id);

  if (error) throw error;
  return data ?? [];
}

async function adminRequest<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  const response = await fetch(`${SUPABASE_FUNCTIONS}/admin-dashboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? "Admin access denied");
  return data as T;
};

export interface AdminOverview {
  totalUsers: number;
  newUsers30d: number;
  activeUsers: number;
  activeDevices: number;
  totalDevices: number;
  lifetimeEntitlements: number;
  monthlyEntitlements: number;
  paymentTotalMinor: number;
  capturedPayments: number;
  failedPayments: number;
  refundedPayments: number;
  totalPayments: number;
  lifetimePaymentCount: number;
  recurringPaymentCount: number;
  lifetimePaymentTotalMinor: number;
  recurringPaymentTotalMinor: number;
  subscriptionBreakdown: Record<string, number>;
  webhookBreakdown: Record<string, number>;
  newUsersByDay: { date: string; count: number }[];
}

export async function fetchAdminOverview(): Promise<AdminOverview> {
  return adminRequest<AdminOverview>("overview");
}

export interface AdminUsersResponse {
  users: unknown[];
  page: number;
  pageSize: number;
  total: number;
}

export async function fetchAdminUsers(page = 1, pageSize = 25, q = ""): Promise<AdminUsersResponse> {
  return adminRequest<AdminUsersResponse>("users", { page, pageSize, q });
}

export async function fetchAdminPayments(page = 1, pageSize = 25): Promise<any> {
  return adminRequest<any>("payments", { page, pageSize });
}

export async function fetchAdminSubscriptions(): Promise<any> {
  return adminRequest<any>("subscriptions");
}

export async function fetchAdminDevices(): Promise<any> {
  return adminRequest<any>("devices");
}

export async function fetchAdminAudit(page = 1, pageSize = 25): Promise<any> {
  return adminRequest<any>("audit", { page, pageSize });
}
