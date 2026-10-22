# Authority and Source of Truth

## Authority order

1. **The owner-approved decision memo** `SORAVO_DECISION_MEMO_2026-10-22.md`, and later written owner approvals.
2. Explicit owner decisions recorded in this pack.
3. Current source code and current configuration in the active Soravo Tauri repository.
4. Current approved ADRs in the ADR index (`15_ADR_INDEX.md`).
5. Product requirements and technical design in this pack.
6. Task breakdown, tests, runbooks and progress/handoff records.
7. Historical notes, old repository documents, generated agent summaries and chat history.

If two sources conflict, do not silently choose. Record the conflict in the state audit output, identify the highest-authority source, and ask the owner only if a product or risk decision is required.

A `PROPOSED` ADR is not a decision. Nothing may be implemented as though a PROPOSED ADR were settled; the ADR must first be made ACCEPTED with a recorded rationale.

## Old repository boundary

The former `soravo` repository is deprecated/historical. It may be read **only** as a behavioral and content reference for approved website pages, pricing presentation and dashboard behaviors. Do not copy or port its:
- source code, components, schema, migrations, Edge Functions, workflows or build scripts;
- Handy-derived architecture or reuse policy;
- security assumptions or release configuration;
- product requirements written for a different implementation.

It may also be read only to understand the owner's desired documentation breadth and continuity discipline. Every new technical choice must be justified against the current Tauri repo and current official vendor docs.

Note that the historical repository currently holds the live production deployment of `soravo.xyz`. That is a fact to be aware of when planning the cutover; it is **not** a reason to treat the historical repository as an implementation source, and the production site must remain untouched until the replacement passes its launch checklist (ADR-0008, `27_PRODUCTION_CUTOVER_AND_ROLLBACK.md`).

## Names and repository identity

Current observed remote: `eySRbS4zgHuW3gMFZB2/soravo_electron`, public at audit time.
Desired steady state:
- Active product repo: `soravo`.
- Old repo: `soravo_deprecated`.
- Local active folder: `soravo`.

**Order is fixed (ADR-0009; owner decision memo, decision 2).** Baseline CI must be green in `soravo_electron` **before** any repository is renamed. The release-packaging check is the single documented exception: it must exist, run, and report, with its red result recorded as the known missing-engine baseline. Any other packaging-check failure blocks the rename. The rename checklist must be prepared and owner-reviewed first. The sequence is: backup and audit → baseline CI and release-packaging checks → rename checklist preparation → rename → post-rename verification.

Rename order matters because GitHub repository names must be unique:
1. Confirm both repositories and local clones are backed up and clean.
2. Rename the old repository `soravo` to `soravo_deprecated`.
3. Rename the active Tauri repo `soravo_electron` to `soravo`.
4. Update local folder name to `soravo` only after closing editors/terminals that use it.
5. Update `origin` URL and verify `git remote -v`, fetch and push.
6. Update README clone commands, package metadata where appropriate, docs, CI secrets/repository references, Cloudflare Pages connection, OAuth callback URLs, release links, and any hard-coded GitHub URLs.
7. Re-verify every affected integration individually. **Do not assume GitHub redirects guarantee that every third-party integration follows the rename.**
8. Confirm the new active repo identity in GitHub before proceeding.

If the owner cannot safely rename the old repo first, use `soravo_tauri` as a temporary active name. Do not create ambiguous simultaneous repos called Soravo.

## Required evidence

At session start, agent must inspect current branch, `git status`, latest commit, repository remote, top-level tree, CI status and the files relevant to the requested task. Do not rely on a prior agent's summary when the live repository is accessible.

## Uncertainty labels

Use `CONFIRMED`, `INFERRED`, `PROPOSED`, `NEEDS OWNER`, and `BLOCKED`. Do not present a proposed architecture as an existing implementation.
