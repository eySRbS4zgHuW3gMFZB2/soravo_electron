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
- **Redirect** — the replacement publishes at a **different** path, and the old path serves a permanent redirect to it. The source and target paths must differ; a redirect whose target is its own source is a self-redirect loop.
- **Retire** — the path intentionally disappears. This requires owner approval per path, and the page must state what happened and where to go instead.
- **Block** — administrative or sensitive paths (for example the admin route) that must never be publicly reachable on the replacement without server-side authorization.

**Route sensitivity is recorded separately from content disposition.** Preserve, Redirect, Retire and Block describe what happens to the *content* at a path. A separate column records the path's **sensitivity** and the **authorization it requires** — public, authenticated, or admin-only. Changing a path's content disposition must never remove its authorization requirement: a path classified as Preserve is still admin-only if it was admin-only before, and re-classifying content never grants or removes access on its own. Access is enforced server-side in the replacement, and the admin-denial check for an ordinary user is part of the cutover verification.

Record the inventory as a table with: current path, current title, content disposition (Preserve/Redirect/Retire/Block), replacement path, required authorization, and owner approval. Paths classified as Retire or Block without explicit approval are treated as Preserve by default — **and their required authorization is carried over unchanged.**

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
- [ ] **If ADR-0007 has been accepted**, the keepalive workflow is scheduled, has been observed to succeed, and its failure path notifies the owner. **If ADR-0007 is still PROPOSED**, the approved project-health monitoring check is in place and has been observed instead — a keepalive run is not required for an undecided workflow.
- [ ] Backup and restore expectations for production data are recorded.
- [ ] **Before the production snapshot and before any production write, a durable change-capture or provider-supported recovery mechanism is enabled for every production account, entitlement and payment create, update and delete.** Its retention, and its ability to recover deleted rows and earlier versions of updated rows, must be tested and recorded. An export taken during a rollback cannot reconstruct a deleted row or the prior state of an updated row from the current tables alone, so the capture must already be running. **Do not assume Supabase point-in-time recovery supplies this** — it is a separate paid add-on and this pack assumes the free tier, where it is not available. If no such mechanism can be enabled and tested, the cutover must not proceed on a free tier.

**Cutover mechanics**
- [ ] The URL inventory is complete and each path is classified and approved.
- [ ] Redirects are configured and each one has been tested from a logged-out browser.
- [ ] Business email still delivers after any DNS-related change; a test message to a non-team address has been received.
- [ ] The rollback procedure below has been **executed as a dry run** in a representative non-production or provider-supported staging environment. The rehearsal must exercise restoring DNS and Cloudflare routing, disabling redirects, selecting the previous deployment, and restoring or reconciling a disposable data snapshot. **It must also exercise the post-migration schema:** if the cutover applied database migrations, the rehearsal must prove that the previous deployment can still run against the resulting schema, or that the migration's rollback and forward-fix path works. **It must also exercise the change-set replay:** the rehearsal must capture a post-snapshot change set containing creates, updates and deletes, replay it, and verify the result by record identity — because the rollback procedure forbids a snapshot restore without that separately tested replay procedure. A rollback that fails at the schema or replay step, before service verification, is not a rehearsal. Record the provider-specific steps, identifiers, results and evidence. **A tabletop review alone does not satisfy this item.**
- [ ] **Before cutover**, one payment has been run against the separate **staging** environment using **Razorpay test-mode credentials**, and the staging entitlement and the staging admin record have been confirmed. A test-mode event must never be run against the production ledger, because it could record a paid production entitlement with no live charge behind it.
- [ ] Owner has given explicit approval for the cutover window.

## Cutover procedure

Perform in this order, stopping at the first failure.

1. Announce the window and confirm the owner is present.
2. Take a restorable snapshot of production data and record the exact rollback target.
3. Deploy the replacement build to the production hostname. Keep the previous deployment available and identifiable.
4. Verify in a logged-out browser and on a second network: home, pricing, download, legal, privacy, support, and **access denial for the admin route**. Then **sign in with a test account** and verify the account dashboard, the entitlement display and the device list. A logged-out visitor cannot check an authenticated dashboard, so the two checks are separate.
5. Verify a real download and checksum from the download page.
6. Verify business email delivery.
7. **After deployment to production**, use a separately approved live payment to confirm the production entitlement and the production admin record, then refund it, recording the owner approval, the reconciliation evidence and the refund evidence.
8. Enable redirects for classified paths.
9. Update the live site's own references: sitemap, robots, canonical URLs, Open Graph URLs and any hard-coded absolute URLs.
10. Record the cutover: date, commit SHA, deployment ID, versions of the site and the desktop app, and the rollback target.

## Rollback

Rollback must be achievable within the incident window without a code change.

**Trigger conditions.** Roll back when the replacement is unavailable, when authentication or payment fails for real customers, when business email breaks, when legal or privacy pages are missing or wrong, when the download or checksum path fails, or when any data-integrity problem appears in production data.

**Procedure.**
1. **Freeze every writer that touches the production datastore** — the replacement's accounts, entitlements and payments paths, and any other service writing to it. This happens **before** traffic is restored: restoring traffic to the previous deployment while the replacement can still write lets the two versions interleave and corrupt the record. Verify the freeze is in effect, then proceed.
2. Restore DNS and Cloudflare routing to the previous production deployment.
3. Disable the redirects, returning the old paths to the previous site's content.
4. **Recover the data safely.** An unqualified snapshot restore can discard real accounts, payments and entitlements created after the snapshot was taken. The recovery sequence is:
   a. **Freeze writes** to the replacement's data paths (accounts, entitlements, payments) so that no new records appear during recovery.
   b. **Export from the enabled change-capture or recovery mechanism a replayable change set for every post-snapshot create, update, and delete**, and record counts by operation, so that snapshot restoration can preserve all post-snapshot changes. Creates alone are not enough: renewals, refunds and entitlement changes are updates to existing rows, and a snapshot restore would reverse them.
   c. **Apply a tested forward-fix or merge procedure** to carry that change set forward. This is the preferred outcome, because it preserves real payments and accounts.
   d. **Restore the snapshot only if** the forward-fix or merge cannot be applied or verified **and** a separately available, tested replay procedure for the exported change set is available and verified. Restoring is a last resort, and it must be followed by replaying that change set through the verified replay procedure. A procedure that is unavailable or unverified is not a fallback.
   e. **Verify the replayed change set** from step (b) by **record identity**, not only by count: every create, update and delete must be applied, and the resulting records must match the change set on stable record IDs and on the relevant fields. Equal counts alone do not prove the replay restored the same records — a missing payment can be hidden by an unrelated or duplicate record with the same count. Check explicitly for duplicates after replay.
   "Reconcile any legitimate records" is not a recovery method on its own, and must not be used as one.
5. Verify home, pricing, download, sign-in and business email again.
6. **Unfreeze writers** only once the recovered state is verified, and record which writers were frozen and when they were released.
7. Record what happened, what was rolled back, and what must be fixed before the next attempt.

**Precondition.** The previous deployment must remain reachable and identifiable for the whole rollback window. Do not delete or overwrite it as part of cutover. "Do not silently repoint an already published version to different bytes" applies to release artifacts as well as to the site.

## Verification method

Evidence for each checklist item is one of: a recorded test run with its output, a screenshot that contains no secrets or personal data, a configuration value confirmed read-only from the provider dashboard, or an owner's written confirmation. A statement that something "should" work is not evidence.

## Ownership

The owner approves the cutover. The agent prepares, verifies and presents evidence. The agent does not cut over, change DNS, alter production Cloudflare settings, or deploy to the production hostname without explicit approval at that moment.
