# Privacy, Legal and Launch Checklist

This is an engineering checklist, not legal advice.

## Privacy promises
- Accurately describe that transcription audio and transcript are processed locally by the current ASR pipeline.
- Account, licensing, payment and website analytics necessarily involve limited network metadata. Do not say “no network traffic” or “no data ever leaves device” once accounts are introduced.
- State exactly what is sent to Supabase, Razorpay, Resend, Cloudflare and GitHub release infrastructure.
- Do not upload audio/transcripts to licensing/payment systems.
- Explain device identifiers, last-seen timestamps, plan state, payment status and analytics.
- Provide data export and account deletion request process.
- Define retention for account, payment and audit records; statutory payment record retention may limit deletion.
- Cloudflare Web Analytics is used for site metrics; link to current vendor privacy documentation and describe accurately.

## Required public pages before taking money
- Terms of service / license agreement.
- Privacy policy.
- Refund and cancellation policy.
- Pricing with recurring billing clarity.
- Support/contact route and response expectations.
- Download/install guide including Windows SmartScreen and Linux dependency notes.
- Release notes and SHA-256 verification instructions.
- Enterprise availability statement that does not imply the plan is purchasable.

## Production cutover
- [ ] Every existing public URL is classified as Preserve, Redirect, Retire or Block; Retire and Block have owner approval.
- [ ] Redirects are configured and tested from a logged-out browser.
- [ ] A restorable production data snapshot exists and the rollback target is recorded.
- [ ] The rollback procedure has been rehearsed.
- [ ] The previous production deployment remains reachable and identifiable.
- [ ] Business email is verified delivering after any DNS-related change.
- [ ] The live production site was not modified before this point in the work.
- [ ] Owner has approved the cutover separately from the release approval.
See `27_PRODUCTION_CUTOVER_AND_ROLLBACK.md`.

## India/international commerce review
Before live Razorpay sales, verify account approval, supported currencies/countries, subscription support, tax invoice requirements, GST and cross-border obligations with qualified local advice. Do not hardcode assumptions from general web research.

## Owner sign-off
No public sale until owner confirms:
- terms/policy wording reviewed;
- displayed price and renewal interval correct;
- cancellation/refund path tested;
- account recovery works;
- payment reconciliation works;
- no misleading security/privacy claims.
