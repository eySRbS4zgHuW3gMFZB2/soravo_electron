import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase environment variables not set. " +
      "Copy website/.env.example to website/.env and fill in values."
  );
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key",
  {
    auth: { persistSession: true, autoRefreshToken: true },
    realtime: { params: { eventsPerSecond: 2 } },
  }
);

export type PlanCode = "monthly" | "lifetime";
export type EntitlementStatus =
  | "unactivated"
  | "active"
  | "grace"
  | "expired"
  | "payment_pending"
  | "payment_failed"
  | "revoked"
  | "lifetime_active"
  | "support_review";

export interface Profile {
  user_id: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Entitlement {
  id: string;
  user_id: string;
  plan_code: PlanCode;
  status: EntitlementStatus;
  issued_at: string;
  last_verified_at: string | null;
  subscription_period_end: string | null;
  lifetime: boolean;
}