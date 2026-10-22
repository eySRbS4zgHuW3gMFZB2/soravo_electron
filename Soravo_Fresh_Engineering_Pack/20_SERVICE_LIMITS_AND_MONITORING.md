# Service Limits, Free-Tier Assumptions and Monitoring

Free tiers can change. Verify official docs and account-specific eligibility before launch. No uptime or cost guarantee is implied.

## Supabase
- Free projects can be paused after low activity over a seven-day period.
- The owner wants a GitHub Action every four days. Prefer a minimal read-only health query or safe transaction; do not create/delete dummy rows unless a real test requires it.
- Keepalive is a mitigation, not a guarantee. Monitor status, warning emails and failed workflow runs.
- Free plan quotas, database size, egress, Auth limits and backups must be checked before launch.
- Use staging and production projects only if the active project limit permits it; otherwise plan careful staging alternatives.

## Resend
- Owner intends to use Resend free tier as Supabase SMTP.
- Official pricing has listed 3,000 emails/month and 100 emails/day for free; verify current plan and account limits at implementation.
- Configure sender domain and DNS records; test messages to non-team addresses.
- Monitor bounce, complaint and rate-limit behavior. Avoid sending marketing email unless separately configured and legally compliant.

## Cloudflare Pages and Web Analytics
- Pages hosts website assets, not large installer files.
- Verify current build/deployment limits and account setup.
- Web Analytics is the initial site-traffic source; avoid claiming it is integrated into a custom admin dashboard unless actual API/report access supports that.
- API tokens must be narrowly scoped.

## GitHub Actions
- Standard runner usage for public repos is generally free under current GitHub policy. Private repo quotas differ.
- Use the public phase to build/test and establish workflows; do not keep source public solely to save CI minutes without an explicit owner risk decision.
- Keep workflows lean and path-filtered; monitor Actions usage.

## GitHub Releases
- Official docs list up to 1,000 assets per release and less than 2 GiB per asset, with no total bandwidth limit documented.
- Use a separate artifact-only repo if source will be private.
- Verify current limits and anonymous downloads before launch.

## Alerts
- GitHub Action keepalive failure: log and surface repeated failures.
- Supabase project pause warning: owner action needed; do not assume automation prevents pausing.
- Resend quota/bounce failures: expose a support path.
- Payment webhook failures: alert and reconcile before granting entitlements.
- Release checksum mismatch: halt release immediately.
