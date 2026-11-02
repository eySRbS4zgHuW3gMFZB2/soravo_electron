import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.0";
import { createDesktopAuthHandoffHandler, type AuthClient } from "./handler.ts";

Deno.serve(createDesktopAuthHandoffHandler({
  readEnvironment: () => ({
    supabaseUrl: Deno.env.get("SUPABASE_URL"),
    anonKey: Deno.env.get("SUPABASE_ANON_KEY"),
    serviceKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
  }),
  createClient: (url, key) => createClient(url, key) as unknown as AuthClient,
  now: () => new Date(),
}));
