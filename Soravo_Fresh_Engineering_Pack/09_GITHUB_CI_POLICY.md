# GitHub Actions and Branching Policy

## Use the public-repository CI window

While the active repository remains public, standard GitHub-hosted runner usage is generally free for public repositories. Use this period to build robust CI before changing visibility. Confirm current GitHub policy before relying on it; usage terms can change.

**Establish CI before renaming.** Per ADR-0009, every **non-packaging** baseline check must exist and be **green** in `soravo_electron` before any repository is renamed, and the release-packaging check must **exist, run, and report** its one permitted baseline result (see the next paragraph). A rename changes the repository URL and can invalidate workflow secret scoping, so the automation must already be proven before the name changes.

**The release-packaging check has a documented baseline exception.** The current Tauri configuration bundles no engine, so the packaging check is expected to be **red** until Phase 1 implements the bundle layout. The rename therefore requires the check to **exist, run, and report** — with its red result recorded as the known baseline — not to be green. It becomes a required green check in Phase 1, and no release may ship while it is red. A red packaging check for any *other* reason is a genuine failure and blocks the rename. See `05_IMPLEMENTATION_PLAN.md` Phase 0, "The packaging-check baseline exception".

## Required workflow families

1. `ci-desktop.yml`
   - triggers on pull requests and pushes;
   - Node dependency install using lockfile;
   - formatting/lint/typecheck/build where configured;
   - Rust format check, clippy and tests;
   - Windows build/test on Windows runner;
   - **Linux build/test on a Linux runner - verification build permitted now, publication still blocked.** A **verification** build is permitted now because the Linux CrispASR engine is tracked and bundled; the Linux release gate cannot be satisfied without it, and what stays prohibited until the full gate passes is publishing a Linux artifact and describing Linux as supported. **Linux jobs become required checks only at that point.** Until then a Linux job must not be a required check, because Phase 1 is Windows-only and the Windows release path proceeds independently of Linux;
   - upload installers as temporary CI artifacts, not customer releases on every PR.

2. `ci-website.yml`
   - run on every pull request, and **report success when the change does not affect `website/**` or the shared docs and design tokens it consumes**; otherwise run the website checks. A path filter alone would leave a required check pending on any pull request that does not match the filter, which blocks the pull request forever;
   - install from website lockfile;
   - lint/typecheck/build;
   - Playwright smoke/E2E tests;
   - dependency audit and secret scan where feasible.

3. `ci-supabase.yml`
   - validate migration ordering and SQL formatting;
   - start local Supabase only if the current workflow can do so within reasonable public CI time;
   - test migration replay, RLS policies and edge functions in an isolated environment;
   - never connect CI tests to production for destructive test data.

4. `security.yml`
   - secret scanning, dependency review, Dependabot, Rust/npm audit;
   - pin third-party actions to immutable SHAs where feasible;
   - least-privilege `permissions`;
   - avoid pull-request secrets for untrusted fork PRs.

5. `release.yml`
   - run only on approved version tags or manually dispatched with protected environment approval;
   - build Windows and Linux from clean runners, **building only the platforms that have a supported engine** — Linux only once task P1-05 has delivered a Linux engine and the Linux release gate has passed;
   - **test installed bundle/resource presence** — the built artifact must actually contain the CrispASR engine and its runtime dependencies, sourced from a git-tracked path (ADR-0010). Inspecting the artifact is required; inferring presence from its size is not;
   - generate SHA-256 checksums after final artifacts;
   - upload artifacts to the chosen public release repository/host;
   - publish release notes and provenance metadata;
   - never deploy a release from an unreviewed branch;
   - never publish before ADR-0005 is ACCEPTED.

6. `pages-deploy.yml` (if GitHub Actions is selected for Pages)
   - path-filter website changes;
   - preview/production separation;
   - protected production environment and Cloudflare token limited to required zone/project;
   - no production secrets on fork PRs;
   - **the production hostname is never a CI target.** Deployment to the live production hostname, and any DNS change, is a separately approved cutover step (`27_PRODUCTION_CUTOVER_AND_ROLLBACK.md`), not a CI side effect of a push to `main`.

7. `supabase-keepalive.yml`
   - schedule every 4 days only after it is tested and owner approves;
   - run a minimal, non-destructive query/transaction against the intended project;
   - avoid create/delete dummy rows unless the operation genuinely tests a needed path; prefer a trivial health query because dummy mutations can fail and pollute audit/data;
   - use a dedicated least-privilege credential where possible, not the service-role key if not required;
   - log success/failure without secrets and alert the owner if failure repeats.
   - Supabase states that inactivity pausing is based on low database activity over seven days; a keepalive is a mitigation, not a contractual guarantee. Monitor dashboard notices and verify activity counts.

## Pull request gates

- Required status checks must pass.
- No unresolved critical/high security finding.
- Review diff and generated artifacts.
- CodeRabbit review for substantive PRs where quota is available.
- Branch protection/ruleset: protect `main`, require PR and checks; prevent force push/deletion.
- Keep `main` deployable. Use feature branches and squash/linear merge if configured.
- Each task is developed on its own branch in its own worktree, per `28_GIT_WORKTREE_POLICY.md`. The branch name carries the task ID, so a CI run can be traced to the task that caused it. A worktree left on a detached HEAD has no named branch, so its work is harder to attribute and easier to lose, and it must not be integrated in that state.

## Efficiency

Use path filters, dependency caching and job matrices. Avoid running the entire cross-platform matrix for docs-only changes. Keep release builds separate from fast PR checks. Track actual public CI minutes and runtime.
