# New Project Isolation and Safe Setup Guide

## Status: Documentation only — no infrastructure created

## Purpose

Establish that the new Soravo app uses completely new, isolated infrastructure.
The existing live website at `soravo.xyz` and the existing Supabase project named `soravo`
belong to the past project (historical `soravo` repository) and must remain untouched.

## Isolation Requirements

### 1. Supabase — New Project

- **Do NOT** reuse the existing Supabase project named `soravo`
- **Do NOT** copy, migrate, or modify its data, schema, RLS policies, or auth settings
- **Do NOT** reuse its anon key, service-role key, or JWT secret
- Create a **new Supabase project** (recommended name: `soravo-fresh` or `soravo-app`)
- The new project starts with an empty database
- **Prerequisite:** The `website/` directory (from `feature/website-foundation` branch) must be merged before applying the migration at `website/supabase/migrations/001_initial_schema.sql`
- The old project remains paused/inactive and is not a dependency

### 2. Cloudflare Pages — New Project

- **Do NOT** modify the existing `soravo.xyz` site, its DNS, or email configuration
- **Do NOT** reuse the existing Cloudflare Pages project or its deployment settings
- Create a **new Cloudflare Pages project** linked to this repository's `website/` directory
- The new project uses non-production credentials for preview deployments
- The production domain `soravo.xyz` stays untouched until an explicitly approved cutover (see `27_PRODUCTION_CUTOVER_AND_ROLLBACK.md`)

### 3. Environment Separation

| Environment | Supabase | Cloudflare Pages | Credentials |
|---|---|---|---|
| Development | Local (Supabase CLI) or dedicated dev project | `localhost:3000` | `.env` with placeholders |
| Staging/Preview | New Supabase project (staging branch or separate project) | Cloudflare Pages preview URL | Non-production keys |
| Production | New Supabase project (production) | New Cloudflare Pages project | Production keys (configured at cutover only) |

### 4. Safe Setup Steps (documentation only — requires owner approval to execute)

**Step 1: Create new Supabase project**
- Organization: new or existing (owner's choice)
- Project name: `soravo-fresh` (or owner's preference)
- Region: choose based on target audience
- Record: project reference ID, API URL, anon key, service-role key (in secure secret store, NOT in git)

**Step 2: Create new Cloudflare Pages project**
- Link to this repository
- Root directory: `website/`
- Build command: `npm run build`
- Output directory: `dist`
- Node version: 20

**Step 3: Configure environment variables**
- In Cloudflare Pages: set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` using the NEW Supabase project's values
- In Supabase: configure Auth redirect URLs for the new Cloudflare Pages domain
- In Supabase: configure Resend SMTP (new credentials, not reused from old project)

**Step 4: Apply initial schema (prerequisite: website/ directory from feature/website-foundation branch)**
- Ensure the `website/` directory exists in the repository (merged from `feature/website-foundation` branch)
- Run `website/supabase/migrations/001_initial_schema.sql` against the new Supabase project
- Verify RLS policies are active

**Step 5: Deploy Edge Functions**
- Deploy Supabase Edge Functions to the new project
- Set Edge Function secrets (service-role key, Razorpay keys, webhook secret)

**Step 6: Verify**
- Test auth flow on preview deployment
- Test database operations with RLS
- Verify no connection to old Supabase project

### 5. What Must NOT Be Done

- Do NOT modify the existing `soravo` Supabase project in any way
- Do NOT modify DNS records for `soravo.xyz`
- Do NOT modify the existing Cloudflare Pages configuration for `soravo.xyz`
- Do NOT copy data, users, or credentials from the old project
- Do NOT reuse the old project's API keys or secrets
- Do NOT point the new website at the old Supabase project, even temporarily

### 6. Verification Checklist (before any production use)

- [ ] New Supabase project created and accessible
- [ ] New Cloudflare Pages project created and deploying
- [ ] Environment variables configured with NEW project credentials
- [ ] Auth redirect URLs point to new Pages domain
- [ ] Initial schema applied to new Supabase project
- [ ] RLS policies verified on new project
- [ ] No reference to old `soravo` Supabase project in any configuration
- [ ] No DNS changes to `soravo.xyz`
- [ ] Preview deployment tested end-to-end