# Product Requirements Document (PRD)

## 1. Product

Soravo is a local-first desktop speech-to-text/dictation application. The existing desktop core is considered feature-complete by the owner for this planning phase. The work covered by this pack is commercial release infrastructure: public website, identity/account system, entitlements, payment processing, dashboards, download/release pipeline, and quality/security hardening needed to sell it.

## 2. Product principles

- Dictation and transcription remain on-device using the current CrispASR integration.
- Commercial services must not receive raw microphone audio or transcript content as part of licensing.
- Account/licensing network failure must not unexpectedly destroy the local dictation workflow.
- Never trust the web renderer alone for entitlement enforcement.
- Payment success must be confirmed by a verified server-side Razorpay event, not a browser redirect.
- No secrets in client bundles, desktop binaries, tracked files, screenshots, issue reports, or agent prompts.
- No paid services are assumed. Any feature requiring a card or paid tier must be flagged before use.
- Keep existing desktop functionality stable; commercial changes are isolated and covered by regression tests.
- Accessibility, honest privacy copy, and transparent installer warnings are launch requirements.

## 3. Launch platforms

Windows and Linux are the initial supported platforms. macOS is out of launch scope unless the owner separately approves a new feasibility and distribution decision. “Tauri targets all” is not evidence of platform support.

Windows release formats must be selected after CI validation (likely NSIS installer and/or MSI). Linux package format(s) must be selected after testing on the supported distribution baseline. Do not claim support for all Linux distributions without testing.

## 4. Commercial plans

- Monthly: USD $12, recurring monthly subscription, maximum 3 active devices per account.
- Lifetime: USD $50, perpetual license, unlimited devices, indefinite offline use.
- Enterprise: deferred. May show “Contact us” only if clearly non-purchasable; no fake checkout, entitlement, SLA or feature promise.

Currency/localized pricing and tax treatment are not finalized in this pack. Razorpay eligibility, international payment support, currency availability, tax obligations and settlement setup must be verified in the owner's actual merchant account before launch.

## 5. Accounts

- Web account creation and sign-in use Supabase Auth.
- Supabase custom SMTP uses Resend free tier, after domain verification and sender configuration.
- Desktop sign-in uses system browser and a short-lived, single-use authorization code/deep-link callback. Do not put access or refresh tokens in URLs.
- Session secrets are stored using an appropriate OS credential store; never plaintext in a general config file.
- User dashboard shows account details, current plan/status, renewal/expiry information, and registered devices.
- User can revoke a device. Revocation should take effect at next online entitlement check, with a documented offline caveat.
- Account deletion/export and privacy-request behavior must be defined before public launch.

## 6. Licensing and entitlements

- Monthly entitlement: up to 3 active devices; online entitlement checks; 14-day offline grace from last successful server verification. Server must define how grace is evaluated and resist clock rollback where feasible.
- Lifetime entitlement: unlimited device registrations and indefinite offline use after a valid activation/entitlement has been received. The exact activation and recovery semantics must be documented. Do not claim remote revocation can affect a device that stays offline indefinitely.
- Do not require internet for ordinary local dictation once the app is entitled, except for initial account/activation and monthly license refresh policy.
- Keep local data/history usable and exportable after a subscription lapses.
- License logic must be implemented in Rust/server-controlled code; renderer state is presentation only.
- Do not store Razorpay-specific semantics inside the desktop client. The client consumes Soravo entitlement states.

## 7. Website and dashboards

Website in `website/`, independent app package/lockfile, built **fresh** in this repository (ADR-0008). The historical `soravo` repository is a **behavioral and content reference only** for approved website content and behavior; its implementation, schema, migrations and Edge Functions are not ported, and the replacement is not a refactor of it.

The existing production site at `soravo.xyz` remains live and unchanged until the replacement passes its launch checklist. Cutover is a separate, explicitly approved, reversible step; see `27_PRODUCTION_CUTOVER_AND_ROLLBACK.md`.

It must include:
- landing page and feature/product pages;
- pricing page with $12 monthly and $50 lifetime, Enterprise deferred;
- download page and release/checksum verification guidance;
- privacy policy, terms, refund/cancellation policy, contact/support information before public sale;
- sign-up/sign-in, email verification/recovery as configured;
- user account dashboard and device management;
- admin dashboard protected by Supabase Auth and server-side role checks.

Admin dashboard MVP:
- user count and growth;
- paid subscription count/status;
- lifetime licenses sold;
- verified gross payment totals and refunds/chargebacks if available from verified payment records;
- basic release/download counts where reliably measurable;
- link to Cloudflare Web Analytics for visitor metrics.

Cloudflare Web Analytics is the first source for site traffic. Do not promise per-user visitor attribution in the admin dashboard unless an approved, privacy-respecting integration supports it.

## 8. Non-goals

- Rebuilding the desktop app UI or transcription engine.
- Importing the old repo's implementation.
- Adding cloud transcription, transcript sync, AI rewriting or meeting recording as part of this release.
- Building enterprise billing, SSO or team administration now.
- DRM claims or an assertion that a binary cannot be patched.
- Guaranteed uninterrupted service from free-tier providers.

## 9. Launch acceptance

A non-technical owner can buy each supported plan, receive a verified entitlement, download a correct installer, install and launch it, sign in, dictate offline according to the plan's policy, manage devices, and receive understandable help if payment or licensing fails.
