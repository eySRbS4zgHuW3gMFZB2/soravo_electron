import { describe, it, expect } from "vitest";
import { supabase } from "./supabase";

describe("Supabase client", () => {
  it("creates a client instance", () => {
    expect(supabase).toBeDefined();
    expect(typeof supabase.auth).toBe("object");
  });

  it("has auth methods", () => {
    expect(typeof supabase.auth.signInWithPassword).toBe("function");
    expect(typeof supabase.auth.signUp).toBe("function");
    expect(typeof supabase.auth.signOut).toBe("function");
    expect(typeof supabase.auth.getSession).toBe("function");
  });
});