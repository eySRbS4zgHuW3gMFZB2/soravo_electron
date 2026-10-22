# Decision Memo — Soravo Fresh Engineering Pack

**Status:** Decisions approved for execution  
**Date:** 2026-10-22  
**Scope:** New clean-room Soravo Tauri project and its future website

## Decisions

1. **Website strategy — rebuild fresh; preserve the current site until cutover.**  
   Build the replacement website in the active Soravo monorepo, following the fresh engineering pack. The historical `soravo` repository may be inspected only as a behavioral/content reference. Do not port its implementation, Supabase schema, migrations, Edge Functions, or Handy-derived desktop code into the new project. Keep `soravo.xyz` and its current production deployment working until the replacement is tested and ready. Plan redirects or URL preservation for relevant existing pages before cutover.

2. **Repository rename — establish CI first.**  
   Do not rename repositories as the first Phase 0 action. First make backups, record Git status/remotes/branch and integration configuration, and establish baseline CI plus release-packaging checks in the current active repository, `soravo_electron`. Then perform the planned rename of the active repository to `soravo` and the historical repository to `soravo_deprecated`, only after preparing and checking a migration checklist. After renaming, verify remotes, GitHub Actions, secrets and permissions, Cloudflare Pages integration/deployment, OAuth/deep-link allowlists, release links, and documentation. Do not assume GitHub redirects guarantee every integration continues to work.

3. **Production domain — preserve it through the migration.**  
   Do not retire, redirect, or repoint `soravo.xyz` at the beginning of this work. Keep the current production site and DNS/email configuration intact while the replacement is built. Cut over only after the replacement passes its launch checklist, including authentication, subscription and payment flows, downloads, legal/privacy pages, production secrets, and smoke tests. Preserve useful existing URLs or configure intentional redirects. Keep a rollback path.

## Required engineering-pack corrections

4. **CrispASR packaging audit.**  
   Correct `23_SOURCE_AUDIT_NOTES.md` to state the inspected repository finding: `third-party/bin/` is ignored and contains no tracked files, while the Windows engine was reported at `third-party/crispasr/extracted/crispasr-windows-x86_64-cpu/`. Treat these paths as an audit finding to reconfirm against the current checkout before implementation. Update the task breakdown and technical design to package the engine from the real, verified location (or another explicitly chosen, tracked staging path). A release is blocked until a clean-machine install proves the app can locate and launch the bundled engine without a developer-only fetch step. Include required runtime dependencies, model acquisition/licensing, and Windows/Linux packaging checks; do not bundle files blindly without checking licensing and redistribution rights.

5. **ADR/TDD consistency.**  
   ADR-0003 (backend placement) and ADR-0005 (binary distribution) must clearly distinguish `PROPOSED` from `ACCEPTED`. Align `04_TECHNICAL_DESIGN.md`, ADR index, implementation plan, and task breakdown so no undecided choice is described as finalized. Record an accepted decision and rationale before implementation depends on it.

## Execution safeguards

- Start with a read-only audit and backup; do not rename repositories, change DNS, alter production deployments, rotate/delete secrets, modify Supabase production data, or make other externally visible changes without explicit approval.
- Treat the new clean-room project and its pack as authoritative for the new implementation. The old repository is reference-only for approved website content/behavior and must not become an implementation source.
- Update the pack's index/manifest if document names, versions, or checksums are maintained there.
- Report each change with file path, reason, and validation. If repository access is unavailable, provide exact proposed edits instead of claiming changes were made.
