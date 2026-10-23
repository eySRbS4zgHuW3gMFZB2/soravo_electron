# Progress and Handoff — Mandatory Living Record

**Last updated:** 2026-10-22 (P1-05 Linux CI audit task)

**Worktree:** `.worktrees/P1-05-linux-audit` · **Branch:** `chore/P1-05-linux-ci-fix` · **Base:** `227d5f0` (`origin/main`, PR #16 merged)

## Task: Complete Linux AppImage build/verification and aggressively optimize CI runtime

### Context
PR #16 added the Linux CrispASR engine, Tauri resource mapping, packaging verifier, and Linux packaging CI. The clean-machine Linux runtime/transcription test remains outstanding (P1-08). The Linux CI job builds the AppImage but does NOT verify the actual AppImage bundle contents — it only runs `verify-packaging.mjs` without `--bundle`.

### Goals
1. Deliver a genuine Linux x86-64 AppImage artifact using the current Tauri v2 app and bundled CrispASR Linux CPU engine.
2. Ensure the Linux job builds the app AND verifies the actual AppImage/bundle contents.
3. Add aggressive, safe CI caching to all applicable workflows (Rust, Node/pnpm, Tauri/CrispASR, AppImage tooling).
4. Preserve Windows behavior, Windows packaging, and all existing required checks.
5. Keep clean-machine Linux runtime transcription as an explicit separate gate.

### Changes planned
- `.github/workflows/packaging.yml`: Add CI caching, fix Linux job to verify actual AppImage contents via `--bundle`
- `scripts/verify-packaging.mjs`: Add Linux engine directory existence check, verify bundled engine files
- No application source changes
- No production changes, no DNS changes, no repository rename

### Evidence required before integration
- Worktree path: `.worktrees/P1-05-linux-audit`
- Branch: `chore/P1-05-linux-ci-fix`
- Base SHA: `227d5f0` (`origin/main`)

## Test results
- [ ] `npm run typecheck` passes
- [ ] `cargo test` passes
- [ ] `npm run tauri:build` builds Linux AppImage
- [ ] `node scripts/verify-packaging.mjs --bundle <path>` verifies AppImage contents
- [ ] CI workflow passes on GitHub

## CodeRabbit findings
- None yet (PR not opened yet)

## Unresolved issues
- Clean-machine Linux runtime transcription test (P1-08) remains outstanding — cannot run Linux CI on Windows worktree
- Linux support remains BLOCKED until clean-machine test passes (per ADR-0010)
