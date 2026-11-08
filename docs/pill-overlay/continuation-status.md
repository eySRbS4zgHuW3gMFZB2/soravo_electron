# PILL-OVERLAY-01 — Continuation Status

**Updated:** 2026-11-07 (session 3 recovery) · **Task:** P9-01 / PILL-OVERLAY-01

## Branch / worktree

- Branch: `feature/PILL-OVERLAY-01-pill-overlay` (linear history, `main` is protected)
- Worktree: `C:\Users\kaya\Desktop\Hydra\soravo\.worktrees\PILL-OVERLAY-01-pill-overlay` (registered in `git worktree list`; base `a9a5a8f`)
- Base: `a9a5a8f` (origin/main at branch creation)
- CrispASR v0.8.43 — **untouched**

## Latest known good state

Commits on branch (newest first): `3865ea4` (tooltip fix + placement capability + docs), `d5a2e6e` (placement 9-zone window), `554abe5` (bar distinction, 112 px hands-free capsule), `70c467c` (FSM + waveform + capsule rebuild), `cd812f7` (task registration). Branch is local; nothing pushed. Runtime currently: app PID 8744 (fresh, post-fix webview); desktop vite PID 12020 on 5173 (manually supervised — NOT the tauri-dev supervisor; website vite on 5174 is down, same as before this session).

Runtime protocol after editing renderer code: **restart the desktop vite** (`powershell -File %TEMP%\opencode\pill-vite.ps1`, or foreground `node node_modules/vite/bin/vite.js` in the worktree) — the old watcher serves stale transforms on this folder — then relaunch `Z:\codex-build-cache\PILL-OVERLAY-01-msvc\x86_64-pc-windows-msvc\debug\soravo.exe` for a fresh webview. Currently running app: PID 9556 (post-fix webview).

Toolchain: ambient cargo (chocolatey 1.98.1) cannot build (E0463). Use pinned rustup **1.90.0 `-x86_64-pc-windows-msvc`** + 2017 BuildTools `vcvars64.bat`, `CARGO_BUILD_TARGET=x86_64-pc-windows-msvc`, `CARGO_TARGET_DIR=Z:\codex-build-cache\PILL-OVERLAY-01-msvc`. Harness scripts: `%TEMP%\opencode\pill-build.bat` (cargo wrapper), `%TEMP%\opencode\pill-run.ps1` (rebuild + `cargo run`).

## Accepted visual baseline (do not touch without cause)

Measured 2026-11-07 ~23:40, 1920×1080 @100% DPI, single monitor, work area bottom = 1040:

- PTT capsule: pure-#000, x **924–995** (72 px), y **994–1021** (28 px); centre x = 960; bottom gap 19 px; dots only, no buttons.
- Hands-free capsule: x **905–1014** (~112 CSS px), y **994–1021**; ✕ circle left (warm grey ≈ rgb 87,84,78), ✓ white circle right, dots between; hover tooltips ✕→"Cancel", ✓→"Finish and paste".
- Capsule renders 28 px tall vs 30 px reference — **owner-accepted** deviation. No Text, no branding, no close button outside these states.

Reference captures: `%TEMP%\opencode\pill-shots\` (`02`, `24` PTT; `07–12` hands-free; `06` processing). Soravo baseline: `%TEMP%\opencode\pill-evidence\base-00…base-10`.

## Accepted hotkey behaviour

- Push-to-talk: hold Mouse5 (machine-specific binding; `Ctrl+1` elsewhere) → record; release → stop + transcribe + paste.
- Hands-free: double-press (release between presses, ≤400 ms) → persists after release; ✕ discards; ✓ finishes + transcribes + pastes; hotkey press = tick.
- Single press never enters hands-free; auto-repeat never converts; release in hands-free is a no-op (FSM unit-tested).

## Completed

1. Reference measurement + audit + FSM spec (`docs/pill-overlay/reference-specification.md`, `current-implementation-audit.md`, `interaction-state-machine.md`) — commits `70c467c`/`d5a2e6e`.
2. FSM rebuild + mic-driven canvas waveform + capsule + anchor placement (`70c467c`, `554abe5`).
3. 9-zone placement mode with ghost-capsule drag, click-select, Esc, flash preview, persistence (`d5a2e6e`); owner-verified at 11:09–11:13.
4. Stale-hover tooltip defect — **diagnosed, fixed, verified live** (`fix-06`/`fix-07`/`fix-08`); capsule re-measured pixel-identical to baseline.
5. Capability hygiene — `placement` window added to `src-tauri/capabilities/default.json`.
6. Baseline capture + measurements; `iteration-log.md`, `verification-report.md` written this session.

## Done this session

1. Recovered actual state: worktree clean at session start, branch `feature/PILL-OVERLAY-01-pill-overlay`, 3 pill commits, no `iteration-log.md`/`verification-report.md`/`continuation-status.md` (now written).
2. Baseline captured and measured **before** any change (`base-00 … base-10`).
3. **Stale tooltip defect** ("Cancel" bubble rendered above the capsule with no buttons; reproduced with cursor far away) — root-caused (hover never cleared on button unmount), fixed in `App.tsx`, **verified live** (`fix-06`/`fix-07`/`fix-08`). Zero visual change; capsule re-measured pixel-identical (x 924–995, y 994–1021).
4. `capabilities/default.json` — `placement` window added to the windows list.
5. **Dev-server staleness root cause:** desktop vite on 5173 serves stale transformed modules on this machine's folder (watcher never fires); after any renderer edit, restart vite (`node node_modules/vite/bin/vite.js` in the worktree) or the webview runs stale code. Recorded for future sessions.
6. Docs written: `iteration-log.md`, `verification-report.md`, this file.

## Incomplete

1. Waveform react-to-speech — runtime verification impossible here (speaker→mic absent); needs owner's spoken test or virtual loopback.
2. Empty transcript → `Error` vs normative `Completed` — owner decision flagged (not changed).
3. DPI 125%/150% + multi-monitor placement — unverified (no scaled/multi display).
4. Full `cargo test` (engine-dependent) — not run this session; `cargo test --lib` = 60/60 green.
5. `iteration-log.md`/`verification-report.md` committed; `progress.md` + pack `18_PROGRESS_AND_HANDOFF.md` updates pending this session.
6. CodeRabbit review — not run this session (quota); optional before merge.
7. Merge/push of the branch — **not** approved; do not merge.

## Latest test results

`npm run typecheck` clean · `npm test` 45/45 · `cargo test --lib --locked` 60/60 · `cargo check` implied by test build.

## Current blockers

- None hard. Acoustic mic verification and scaled/multi-monitor verification are environment-blocked.

## Exact next task

1. Decide/verify: empty transcript → error badge vs silent completion (owner call) — see discrepancies in `verification-report.md`.
2. Owner-run spoken-word check of the waveform (bars must rise above floor) — needs a human voice or virtual loopback; cannot be done on this machine's speakers→mic path.
3. DPI 125%/150% and multi-monitor placement verification (needs a scaled or multi-monitor display).
4. Full `cargo test` (engine-dependent tests) — not re-run this session.
5. Regression sweep + docs final pass; keep `progress.md` + `Soravo_Fresh_Engineering_Pack/18_PROGRESS_AND_HANDOFF.md` current.

## Relevant screenshot paths

Reference (Wispr, not committed): `%TEMP%\opencode\pill-shots\02-pill-crop.png`, `07-handsfree.png`, `11-hover-tick.png`, `10-hover-cross-zoom.png`
Soravo baseline (this session): `%TEMP%\opencode\pill-evidence\base-00 … base-10`
Fix verification: `fix-06-ptt-fixed.png` (fresh PTT hold after restart: no tooltip), `fix-07-hf-hover-cross.png` (hands-free, cursor on ✕: tooltip renders), `fix-08-after-cancel.png` (post-cancel fresh PTT hold: no tooltip; capsule pixel-identical to baseline). `fix-01…fix-05` are pre-vite-restart artifacts showing the stale module; kept as evidence of the staleness failure mode.
