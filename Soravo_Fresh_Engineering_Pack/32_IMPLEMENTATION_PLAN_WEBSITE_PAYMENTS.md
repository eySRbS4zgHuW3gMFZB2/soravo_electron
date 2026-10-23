# Implementation Plan: Website, Account System, and Payment Backend

## Status: Phase 1 — First Scoped Task

## Overview

This document outlines the implementation plan for Soravo's commercial website, account system,
and payment backend. It builds on the website foundation (PR #18) and ADR-0003 (Supabase Edge
Functions as the privileged API backend).

## Architecture

- **Website:** React 18 + TypeScript + Vite + Tailwind v4 + shadcn/ui (in `website/`)
- **Identity:** Supabase Auth (new project, isolated from old `soravo` project)
- **Database:** Supabase Postgres with RLS (schema in `website/supabase/migrations/`)
- **Server-side API:** Supabase Edge Functions (Deno runtime)
- **Payments:** Razorpay (design complete, implementation pending)
- **Hosting:** Cloudflare Pages (new project, isolated from soravo.xyz)

## Phase Breakdown

### Phase A: Server-Side API Foundation (Edge Functions)

- A1: Device registration Edge Function
- A2: Entitlement check Edge Function
- A3: Device listing/revocation Edge Functions
- A4: Admin role verification middleware
- A5: Tests for all Edge Functions

### Phase B: Website Account System

- B1: Device management UI (list, revoke, replace)
- B2: Entitlement display and status
- B3: Download link with device activation
- B4: Account settings (profile, display name)
- B5: Tests for account flows

### Phase C: Razorpay Payment Integration

- C1: Server-side order/subscription creation (Edge Function)
- C2: Webhook verification and processing (Edge Function)
- C3: Entitlement provisioning after verified payment
- C4: Website checkout flow (Razorpay Checkout)
- C5: Payment status display and history
- C6: Tests for payment flows

### Phase D: Desktop Integration

- D1: Deep link registration (soravo://)
- D2: System browser auth flow
- D3: One-time code generation and exchange
- D4: OS credential storage for refresh tokens
- D5: Device registration from desktop
- D6: Entitlement sync and offline grace

## First Scoped Task: Phase A1 — Device Registration Edge Function

### Objective

Implement a Supabase Edge Function that handles device registration from the desktop app.
This is the first server-side API endpoint and establishes the pattern for all subsequent Edge Functions.

### Scope

1. Create `supabase/functions/register-device/index.ts` (Deno/TypeScript)
2. Implement JWT validation and user_id binding
3. Implement device limit checking (monthly: 3, lifetime: unlimited)
4. Return device registration result
5. Add tests (unit tests with mocked Supabase client)
6. Document the Edge Function contract

### What this does NOT include

- Actual deployment to Supabase (requires project setup)
- Desktop app integration (Phase D)
- Payment processing (Phase C)

### Dependencies

- Supabase Edge Functions runtime (Deno)
- Supabase client library for Deno
- JWT validation via Supabase Auth

### Acceptance Criteria

- Edge Function validates JWT from Authorization header
- Device ID is bound to authenticated user
- Monthly device limit (3) is enforced atomically
- Lifetime users have unlimited device registrations
- Refreshing an already-active device is always allowed, even at the limit (it updates `last_seen_at` and any provided non-null `label`/`platform`/`app_version` without consuming a new device slot)
- Reactivating a revoked device counts as a new active device and must pass the limit check
- All side effects are idempotent (re-registering same active device is safe)
- Tests pass with mocked Supabase client

> **Device replacement flow is NOT implemented in Phase A1.** The user-facing
> device-replacement UI (remove a device to free a slot, or replace at the
> 3-device limit) belongs to Phase B (website account system — device
> management). Phase A1 only enforces the limit, and explicitly disallows
> exceeding it.