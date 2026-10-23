import { supabase } from "./supabase";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co";

export interface DeviceRegistrationResult {
  success: boolean;
  device_id: string;
  device_count: number;
  limit_reached: boolean;
  error?: string;
}

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

export async function listDevices(): Promise<{ id: string; device_id: string; label: string | null; platform: string | null; last_seen_at: string }[]> {
  const { data, error } = await supabase
    .from("devices")
    .select("id, device_id, label, platform, last_seen_at")
    .is("revoked_at", null)
    .order("last_seen_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function revokeDevice(deviceId: string): Promise<void> {
  const { error } = await supabase
    .from("devices")
    .update({ revoked_at: new Date().toISOString() })
    .eq("device_id", deviceId);

  if (error) throw error;
}