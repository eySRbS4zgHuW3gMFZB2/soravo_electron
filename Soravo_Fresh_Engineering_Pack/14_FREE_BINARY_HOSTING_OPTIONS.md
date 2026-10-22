# Free Binary Hosting Options

The owner prefers not to host binaries in a public repository. There is no universally best free host; file size, download volume, account eligibility and terms matter. Recheck terms before launch.

## Option A — GitHub Releases in a separate public artifacts-only repository
**Cost:** normally $0 for public release assets under GitHub's documented release limits.  
**Pros:** reliable versioning, release notes, API, familiar downloads, no card generally needed.  
**Cons:** the release repository is public; users can inspect metadata and download counts are not a complete analytics system. Keep source in a separate private repo. Each release asset must be under 2 GiB according to GitHub docs; no total release bandwidth limit is documented.  
**Recommendation:** simplest baseline if “public repo” means a separate repository containing only binaries, not source.

## Option B — SourceForge
**Cost:** free project hosting/download distribution subject to current account and policy terms.  
**Pros:** designed for downloadable software; public project pages and mirrors.  
**Cons:** onboarding/project acceptance and advertising/download experience may be less brand-controlled; inspect current terms and user experience. Verify direct links and checksum behavior before choosing.

## Option C — GitLab Releases in a separate public project
**Cost:** free tier, subject to current storage/transfer limits and account policies.  
**Pros:** release assets can be attached to tags; keeps GitHub source repo separate.  
**Cons:** do not assume unlimited bandwidth; check current quotas and whether anonymous downloads meet the desired UX.

## Option D — Codeberg Releases/attachments
**Cost:** free community-hosted Git forge, subject to current service rules/limits.  
**Pros:** separate public artifact project and open-source-friendly audience.  
**Cons:** availability, quotas, file limits and anonymous download behavior must be checked; do not make it the only production host without validating.

## Option E — Cloudflare R2
**Cost:** published free tier currently includes 10 GB-month standard storage, 1 million Class A and 10 million Class B operations/month, with no egress fee; usage beyond free tier is chargeable.  
**Pros:** object storage/CDN-style distribution, clean domain URLs, separates artifacts from source.  
**Cons:** account setup requires adding an R2 subscription; the dashboard flow may require payment details. Because the owner says a card is impossible, **do not choose R2 unless the account can be enabled without a card/payment method**. Never assume free tier means no payment method required.

## Option F — Cloudflare Pages
Not suitable for installers larger than its per-file deployment limit; use Pages for the website, not large binaries. Check current limits before any use.

## Option G — Release assets from a public GitHub source repository
Technically simple but conflicts with a private-source commercial strategy. Not recommended unless owner explicitly decides the source will remain public.

## Decision rule
1. Estimate installer size and expected download volume.
2. Test anonymous downloads from a logged-out browser and a second network.
3. Confirm file size limits and terms from official current docs.
4. Confirm the service does not require a payment card.
5. Ensure a stable URL/versioned asset, checksum, and release deletion/rollback procedure.
6. Keep source repository separate and private when launch-ready.
7. Maintain a fallback host or downloadable mirror if commercial reliance grows.

**Initial recommendation:** separate public `soravo-releases` GitHub repo is the least operationally complex. If the user rejects any public repository at all, evaluate SourceForge first, then GitLab/Codeberg, with a proof-of-download test before committing.
