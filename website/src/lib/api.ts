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
 * @throws If the caller is not authenticated, the database update fails, or no matching device is found.
 */
export async function revokeDevice(deviceId: string): Promise<void> {
  // Get current user to ensure ownership
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("devices")
    .update({ revoked_at: new Date().toISOString() })
    .eq("device_id", deviceId)
    .eq("user_id", user.id)
    .select("id");

  if (error) throw error;
  if (!data?.length) throw new Error("Device not found");
}