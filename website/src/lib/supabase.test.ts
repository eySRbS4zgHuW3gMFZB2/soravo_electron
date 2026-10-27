import { describe, it, expect, vi } from "vitest";

// Mock the Supabase client to avoid WebSocket dependency in tests
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn(),
  }),
}));

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