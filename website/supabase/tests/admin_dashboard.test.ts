import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Exercise the handler with the real Supabase query builder and synthetic HTTP.
vi.mock("https://esm.sh/@supabase/supabase-js@2.49.0", async () => import("@supabase/supabase-js"));

let handler: (request: Request) => Promise<Response>;
let users: { id: string; email: string }[];
let nameIds: string[];
let displayName: string;
let failure: string | null;
let auditFailed: boolean;
let overviewThrows: boolean;
let authPages: number[];
let profileOffsets: number[];
let enrichmentIds: string[][];
let searchPatterns: string[];
let auditWrites: number;
const overview = { totalUsers: 6005, activeUsers: 1005, paymentTotalMinor: 3015001250 };

async function fakeFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = new URL(String(input));
  const table = url.pathname.split("/").at(-1);
  if (url.pathname === "/auth/v1/user") return Response.json({ id: "admin" });
  if (table === "admin_users") return Response.json({ user_id: "admin", role: "owner" });
  if (url.pathname.endsWith("/rpc/admin_dashboard_overview")) {
    if (overviewThrows) throw new Error("Synthetic connection error");
    return failure === "overview" ? Response.json({ message: "Synthetic failure" }, { status: 500 }) : Response.json(overview);
  }
  if (url.pathname === "/auth/v1/admin/users") {
    const page = Number(url.searchParams.get("page"));
    const perPage = Number(url.searchParams.get("per_page"));
    authPages.push(page);
    if (failure === "auth") return Response.json({ msg: "Synthetic failure" }, { status: 400 });
    return Response.json({ users: users.slice((page - 1) * perPage, page * perPage) });
  }
  if (table === "profiles" && url.searchParams.has("display_name")) {
    const offset = Number(url.searchParams.get("offset"));
    profileOffsets.push(offset);
    searchPatterns.push(url.searchParams.get("display_name")!);
    if (failure === "search") return Response.json({ message: "Synthetic failure" }, { status: 500 });
    // Deliberately cap below the requested batch to exercise continued paging.
    return Response.json(nameIds.slice(offset, offset + 600).map((user_id) => ({ user_id, display_name: displayName })));
  }
  if (table === "admin_audit_events") {
    auditWrites++;
    return auditFailed ? Response.json({ message: "Synthetic audit failure" }, { status: 500 }) : new Response(null, { status: 201 });
  }
  if (["profiles", "entitlements", "payments", "devices"].includes(table!)) {
    const ids = url.searchParams.get("user_id")!.slice(4, -1).split(",");
    enrichmentIds.push(ids);
    expect(ids.length).toBeLessThanOrEqual(50);
    if (failure === table) return Response.json({ message: "Synthetic failure" }, { status: 500 });
    return Response.json(table === "profiles" ? ids.map((user_id) => ({ user_id, display_name: "Name" })) : []);
  }
  throw new Error(`Unexpected request ${url.pathname}`);
}

const request = (body: object) => handler(new Request("https://dashboard.invalid", {
  method: "POST", headers: { Authorization: "Bearer synthetic-user-token" }, body: JSON.stringify(body),
}));

beforeAll(async () => {
  const env: Record<string, string> = {
    SUPABASE_URL: "https://supabase.invalid", SUPABASE_ANON_KEY: "synthetic-anon", SUPABASE_SERVICE_ROLE_KEY: "synthetic-service",
  };
  vi.stubGlobal("Deno", { env: { get: (key: string) => env[key] }, serve: (callback: typeof handler) => { handler = callback; } });
  await import("../functions/admin-dashboard/index");
});

beforeEach(() => {
  users = Array.from({ length: 6005 }, (_, i) => ({ id: `user-${i}`, email: `person-${i}@example.invalid` }));
  nameIds = [];
  displayName = "NEEDLE";
  failure = null;
  auditFailed = false;
  overviewThrows = false;
  authPages = [];
  profileOffsets = [];
  enrichmentIds = [];
  searchPatterns = [];
  auditWrites = 0;
  vi.stubGlobal("fetch", vi.fn(fakeFetch));
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());
afterAll(() => vi.unstubAllGlobals());

describe("admin dashboard handler", () => {
  it("returns the aggregate payload unchanged and audits success", async () => {
    const response = await request({ action: "overview" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(overview);
    expect(auditWrites).toBe(1);
    expect(enrichmentIds).toEqual([]);
  });

  it.each(["returned", "thrown"])("returns 500 for a %s overview query failure", async (kind) => {
    failure = "overview";
    overviewThrows = kind === "thrown";
    expect((await request({ action: "overview" })).status).toBe(500);
    expect(auditWrites).toBe(0);
  });

  it("fails closed when the audit insert returns an error", async () => {
    auditFailed = true;
    expect((await request({ action: "overview" })).status).toBe(500);
    expect(console.error).toHaveBeenCalled();
  });

  it("finds email matches beyond 5000 accounts", async () => {
    const response = await request({ action: "users", q: "PERSON-6004" });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ total: 1, users: [{ userId: "user-6004" }] });
    expect(authPages).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(enrichmentIds).toHaveLength(4);
    expect(enrichmentIds.every((ids) => ids.join() === "user-6004")).toBe(true);
  });

  it("merges email and paged name matches without duplicates, then enriches only the requested page", async () => {
    nameIds = users.slice(4800).map((u) => u.id);
    users[4800].email = "needle@example.invalid";
    const response = await request({ action: "users", q: "needle", page: 49, pageSize: 25 });
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.total).toBe(1205);
    expect(data.users.map((u: { userId: string }) => u.userId)).toEqual(users.slice(6000).map((u) => u.id));
    expect(profileOffsets).toEqual([0, 600, 1200, 1205]);
    expect(enrichmentIds.every((ids) => ids.length === 5)).toBe(true);
  });

  it("treats LIKE wildcard characters as literal search text", async () => {
    expect((await request({ action: "users", q: "  50%_\\off  " })).status).toBe(200);
    expect(searchPatterns).toEqual(["ilike.%50\\%\\_\\\\off%"]);
    expect(enrichmentIds).toEqual([]);
  });

  it("does not treat PostgREST's star alias as a literal name match", async () => {
    nameIds = ["user-6004"];
    const response = await request({ action: "users", q: "nee*le" });
    expect(await response.json()).toMatchObject({ total: 0, users: [] });
    displayName = "Nee*le";
    const literalResponse = await request({ action: "users", q: "nee*le" });
    expect(await literalResponse.json()).toMatchObject({ total: 1, users: [{ userId: "user-6004" }] });
  });

  it.each(["auth", "search", "profiles", "entitlements", "payments", "devices"])("returns 500 on %s lookup failure", async (source) => {
    failure = source;
    const response = await request({ action: "users", q: "person-6004" });
    expect(response.status).toBe(500);
    expect(auditWrites).toBe(0);
  });
});
