# Repository and Local Folder Rename Runbook

**Do not execute automatically.** Repository rename changes URLs and integrations. Owner must approve and both repos must be backed up.

**Order is fixed (owner decision memo, decision 2; ADR-0009):** the rename happens **after** baseline CI is green and the release-packaging check exists, runs, and reports in the current active repository. The check may be red only for the documented missing-engine baseline; any other packaging-check failure blocks the rename. Renaming first would hand the renamed repository automation and secret scoping that has never been proven to work.

## Desired names
- Historical repo: `soravo` → `soravo_deprecated`.
- Active Tauri repo: `soravo_electron` → `soravo`.
- Local active folder: rename to `soravo`.

## Preconditions
- **Baseline CI exists and is green in `soravo_electron`**, with the single documented exception of the release-packaging check (task P0-02). That check is expected to be **red** at this stage, because the current Tauri configuration bundles no engine; what the rename requires is that the check **exists, runs, and reports**, with its red result recorded as the known baseline. It becomes a required green check in Phase 1. A packaging check that is red for any other reason, or that fails to run at all, blocks the rename. See `05_IMPLEMENTATION_PLAN.md` Phase 0, "The packaging-check baseline exception".
- **The rename checklist is prepared and owner-reviewed** (task P0-03): every integration a URL change could break, listed — GitHub Actions workflows and their secret scoping, `gh` invocations, the Cloudflare Pages source link, OAuth and deep-link allowlists, release links, and hard-coded GitHub URLs in README, docs and code.
- Confirm exact repository identities in GitHub.
- Both repos have clean working trees or all changes committed/backed up.
- Confirm the old repo name `soravo_deprecated` is available.
- Save current remotes and important branch/PR references.
- Record the **actual** Cloudflare Pages deployment method for the website project, and confirm GitHub Actions secrets will be updated. **Only if the project uses Cloudflare's Git integration** does the source link need repointing at the renamed repository; the project currently deploys by direct upload, in which case the deployment source is the workflow's token and the repository name does not affect it.
- Record current default branch and latest commit SHA for each repo.

## Sequence
1. Rename old repo `soravo` to `soravo_deprecated` in GitHub repository Settings.
2. Verify old repo redirects and new name exists.
3. Rename active `soravo_electron` to `soravo`.
4. Verify active repository URL and default branch.
5. On local machine, close IDE and terminals using the folder.
6. Rename the local folder using file manager or shell; do not move/delete `.git`.
7. In the renamed folder, run `git remote -v`; set `origin` to the new active URL if needed.
8. Run `git fetch --all --prune`, `git status --short --branch`, and inspect recent log.
9. Update README clone commands and internal absolute GitHub URLs.
10. Update Cloudflare Pages connected repo if necessary; test preview deploy.
11. Check OAuth callback/allowed URLs, GitHub Actions secrets, release workflow target repo and any webhooks.
12. Verify all links and CI.
13. Update progress/handoff with new canonical names.

## Post-rename verification checklist
Each item is verified individually. **Do not assume GitHub's redirect behaviour carries every third-party integration through a rename.**

- [ ] `git remote -v` shows the new URL and fetch/push work.
- [ ] All local branches still track their remote counterparts; no branch lost.
- [ ] `gh` commands resolve the renamed repository correctly.
- [ ] GitHub Actions workflows are listed and run; secrets and variables are still scoped to the repository and still resolve.
- [ ] Required status checks are still attached to `main`; branch protection is intact.
- [ ] Cloudflare Pages project source link (if git-integrated) points at the renamed repository; a **preview** deployment succeeds, and a **read-only** check confirms the existing production deployment at `soravo.xyz` is unchanged and still serving. **Do not deploy to the production hostname during a repository rename** — production cutover is a separate, explicitly approved step (`27_PRODUCTION_CUTOVER_AND_ROLLBACK.md`).
- [ ] OAuth and deep-link allowlists list the new repository URL where relevant.
- [ ] Release workflow target repository and release links resolve.
- [ ] README, `AGENTS.md`, docs, `progress.md` and code contain no stale `soravo_electron` references.
- [ ] Business email and DNS records are unchanged and still delivering.
- [ ] The live production site at `soravo.xyz` is unchanged and still serving.

## Rollback
GitHub redirects may preserve some old URLs but do not assume every third-party integration follows. If workflows fail, fix remote/config URLs; do not rename back without recording why. Do not delete either repository.
