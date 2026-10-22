# Reference Links

Research checked on 2026-10-22. Recheck current pages during implementation because pricing and service limits change.

## Soravo source
- Active repository at audit time: https://github.com/eySRbS4zgHuW3gMFZB2/soravo_electron
- Historical repo (behavioral and content reference for approved website pages, pricing presentation and dashboard behaviors, plus documentation shape; no implementation copying): https://github.com/eySRbS4zgHuW3gMFZB2/soravo

## Official service documentation
- GitHub Releases: https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases
- GitHub Actions billing: https://docs.github.com/en/billing/concepts/product-billing/github-actions
- Cloudflare Pages Git integration: https://developers.cloudflare.com/pages/configuration/git-integration/
- Cloudflare R2 pricing/free tier: https://developers.cloudflare.com/r2/pricing/
- Cloudflare R2 setup: https://developers.cloudflare.com/r2/get-started/
- Supabase project pausing: https://supabase.com/docs/guides/platform/free-project-pausing
- Supabase custom SMTP: https://supabase.com/docs/guides/auth/auth-smtp
- Supabase pricing: https://supabase.com/pricing
- Resend pricing: https://resend.com/pricing
- Razorpay webhooks: https://razorpay.com/docs/webhooks/
- Razorpay subscriptions: https://razorpay.com/docs/payments/subscriptions/
- Tauri v2 deep links: https://v2.tauri.app/plugin/deep-linking/
- Tauri updater signing: https://v2.tauri.app/plugin/updater/
- shadcn/ui: https://ui.shadcn.com/
- Playwright: https://playwright.dev/docs/intro
- CodeRabbit CLI: https://docs.coderabbit.ai/cli/overview

## Hosting notes from official research
- GitHub documents release assets as under 2 GiB each, up to 1,000 assets per release, with no total bandwidth usage limit documented.
- Cloudflare R2 currently lists 10 GB-month standard storage, 1 million Class A operations, 10 million Class B operations, and no egress fees in its free tier. **R2 requires an R2 subscription and a checkout flow, which means a payment method.** Because the owner cannot use a card, R2 is **ineligible**: it must not be selected unless eligibility is confirmed first, and confirmation is a hard gate rather than a formality.
- Supabase says free projects may pause after low database activity over a 7-day period. A keepalive is mitigation only.
- Supabase says default SMTP is restricted and recommends custom SMTP for real user email flows.
- Cloudflare Pages supports Git integration with GitHub/GitLab; do not assume private repo automatically requires Wrangler direct deploy.
- GitHub standard runner usage is free for public repositories under current policy. Private repo usage is subject to plan quota.

## Alternative free binary hosts to verify
- SourceForge: https://sourceforge.net/
- GitLab Releases: https://docs.gitlab.com/user/project/releases/
- Codeberg: https://codeberg.org/
Do not treat an alternative as approved until anonymous download, file size, quota, terms and no-card requirement are tested.
