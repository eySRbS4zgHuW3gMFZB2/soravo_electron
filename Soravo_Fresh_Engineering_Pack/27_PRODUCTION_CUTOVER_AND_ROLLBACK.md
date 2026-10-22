# Production Domain Cutover and Rollback

**Status:** Requirements document. No cutover is authorised by this document.  
**Authority:** Owner decision memo `SORAVO_DECISION_MEMO_2026-10-22.md`, decision 3.  
**Related:** ADR-0008 (website rebuild strategy and production-site preservation), ADR-0009 (rename ordering), `05_IMPLEMENTATION_PLAN.md` Phase 8, `13_RELEASE_RUNBOOK.md`, `16_PRIVACY_LEGAL_LAUNCH_CHECKLIST.md`.

## Purpose

The replacement website is built fresh. The existing production site at `soravo.xyz` must keep serving correctly for the entire build period, and cutover to the replacement must be an explicit, reversible, separately-approved act.

## Non-negotiable invariants

1. **The current production site and its DNS and email configuration stay untouched until cutover.** No retire, no redirect, no repoint, no record change, no nameserver change, no email-configuration change.
2. **The existing business email configuration is preserved.** MX, SPF, DKIM and DMARC records must be reproduced exactly wherever DNS is eventually moved, or business email breaks. Verify before any DNS change.
3. **Cutover happens only after the replacement passes its launch checklist** — authentication, subscription and payment flows, downloads, legal and privacy pages, production secrets, and smoke tests.
4. **Cutover is reversible.** A documented rollback path must exist and be exercised before cutover, not merely described.
5. **No external, visible or destructive action occurs without explicit owner approval.** This includes repository renames, DNS changes, Cloudflare production settings changes, deployment of the replacement to the production hostname, production Supabase data changes, and secret rotation or deletion.

## Current state as audited

Recorded for planning only; re-verify at cutover time.

- The production hostname `soravo.xyz` and the Cloudflare Pages project `soravo` are live.
- The Pages project was last deployed from the **historical** repository's commit, so the currently served site is built from the historical repository, not from the active Tauri repository.
- The Pages project is deployed by **direct upload** rather than by Cloudflare's Git integration, so repository renaming does not by itself break the deployment. This is a property to re-verify after any rename, not a permanent guarantee.

## URL inventory and preservation

Before cutover, enumerate every publicly reachable URL of the existing site and classify it. At minimum this includes the home page, feature and pricing pages, the download page, FAQ, support and contact routes, sign-in and account routes, and the admin route.

Each URL is classified as one of:

- **Preserve** — the replacement publishes the same path with equivalent or better content. No action beyond building it.
- **Redirect** — the replacement publishes the same path; the old path is served as a permanent redirect to it.
- **Retire** — the path intentionally disappears. This requires owner approval per path, and the page must state what happened and where to go instead.
- **Block** — administrative or sensitive paths (for example the admin route) that must never be publicly reachable on the replacement without server-side authorization.

Record the inventory as a table with: current path, current title, classification, replacement path, and owner approval. Paths classified as Retire or Block without explicit approval are treated as Preserve by default.

## Cutover prerequisites

Every item must be checked and evidenced. An unchecked item blocks cutover.

**Content and behaviour**
- [ ] All marketing, pricing, legal, privacy, refund, support and download pages are live on the replacement.
- [ ] Pricing displays the approved $12 monthly and $50 lifetime plans with correct renewal interval and currency handling.
- [ ] Enterprise is presented as unavailable in a way that cannot be mistaken for purchasable.
- [ ] Sign-up, sign-in, sign-out, password recovery and email verification work against production configuration.
- [ ] The user dashboard shows plan, status, renewal or expiry, and registered devices, and device revocation works.
- [ ] The admin dashboard is reachable by an admin and refused for an ordinary user, including on direct API calls.
- [ ] A real test payment in Razorpay test mode produces a verified entitlement and an admin-visible record, and a browser redirect alone grants nothing.
- [ ] The download page links to real release assets that download anonymously and whose SHA-256 checksums verify.

**Operations**
- [ ] Production secrets are set in the production secret store and are absent from the repository, build output and logs.
- [ ] Preview and production environments are demonstrably separate; preview never reaches production Supabase or live Razorpay.
- [ ] Database migrations have been applied to production through the migration path, with a recorded rollback or forward-fix plan.
- [ ] The keepalive workflow is scheduled, has been observed to succeed, and its failure path notifies the owner.
- [ ] Backup and restore expectations for production data are recorded.

**Cutover mechanics**
- [ ] The URL inventory is complete and each path is classified and approved.
- [ ] Redirects are configured and each one has been tested from a logged-out browser.
- [ ] Business email still delivers after any DNS-related change; a test message to a non-team address has been received.
- [ ] The rollback procedure below has been rehearsed, at least as a dry run.
- [ ] Owner has given explicit approval for the cutover window.

## Cutover procedure

Perform in this order, stopping at the first failure.

1. Announce the window and confirm the owner is present.
2. Take a restorable snapshot of production data and record the exact rollback target.
3. Deploy the replacement build to the production hostname. Keep the previous deployment available and identifiable.
4. Verify, in a logged-out browser and on a second network: home, pricing, download, legal, privacy, support, sign-up, sign-in, recovery, account dashboard, and admin denial for an ordinary user.
5. Verify a real download and checksum from the download page.
6. Verify business email delivery.
7. Send one real test payment and confirm the entitlement and the admin record, then refund it.
8. Enable redirects for classified paths.
9. Update the live site's own references: sitemap, robots, canonical URLs, Open Graph URLs and any hard-coded absolute URLs.
10. Record the cutover: date, commit SHA, deployment ID, versions of the site and the desktop app, and the rollback target.

## Rollback

Rollback must be achievable within the incident window without a code change.

**Trigger conditions.** Roll back when the replacement is unavailable, when authentication or payment fails for real customers, when business email breaks, when legal or privacy pages are missing or wrong, when the download or checksum path fails, or when any data-integrity problem appears in production data.

**Procedure.**
1. Restore DNS and Cloudflare routing to the previous production deployment.
2. Disable the redirects, returning the old paths to the previous site's content.
3. If production data was written by the replacement and is incompatible with the previous site, restore the snapshot taken at step 2 of the cutover, then reconcile any legitimate records created after it.
4. Verify home, pricing, download, sign-in and business email again.
5. Record what happened, what was rolled back, and what must be fixed before the next attempt.

**Precondition.** The previous deployment must remain reachable and identifiable for the whole rollback window. Do not delete or overwrite it as part of cutover. "Do not silently repoint an already published version to different bytes" applies to release artifacts as well as to the site.

## Verification method

Evidence for each checklist item is one of: a recorded test run with its output, a screenshot that contains no secrets or personal data, a configuration value confirmed read-only from the provider dashboard, or an owner's written confirmation. A statement that something "should" work is not evidence.

## Ownership

The owner approves the cutover. The agent prepares, verifies and presents evidence. The agent does not cut over, change DNS, alter production Cloudflare settings, or deploy to the production hostname without explicit approval at that moment.
