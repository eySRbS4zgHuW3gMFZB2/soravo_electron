# PILL-OVERLAY-01 — Continuation Status

**Updated:** 2026-11-07 (session 3 recovery) · **Task:** P9-01 / PILL-OVERLAY-01

## Branch / worktree

- Branch: `feature/PILL-OVERLAY-01-pill-overlay` (linear history, `main` is protected)
- Pull request: **#47** — "PILL-OVERLAY-01 — Reconstruct the floating dictation pill" (open, base `main`, 14 commits at last update; body documents the issue, the fix, verification and open items; created by this session 2026-11-08 from the full branch scope)
- Worktree: `C:\Users\kaya\Desktop\Hydra\soravo\.worktrees\PILL-OVERLAY-01-pill-overlay` (registered in `git worktree list`; base `a9a5a8f`)
- Base: `a9a5a8f` (origin/main at branch creation)
- CrispASR v0.8.43 — **untouched**

## Latest known good state

Commits on branch (newest first): `5a5baca` (docs: full cargo test record), `3865ea4` (tooltip fix + placement capability + docs), `d5a2e6e` (placement 9-zone window), `554abe5` (bar distinction, 112 px hands-free capsule), `70c467c` (FSM + waveform + capsule rebuild), `cd812f7` (task registration), plus this session's error-state-removal checkpoint. Branch is local; nothing pushed. Runtime currently: app PID 8512 (fresh, post-error-removal webview); desktop vite PID 4624 on 5173 (manually supervised — NOT the tauri-dev supervisor; website vite on 5174 is down, same as before this session).

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

## Done 2026-11-08

7. **Pill error state removed entirely (owner request).** No red dot, no `.pill-err`, no `data-mode="error"` capsule, no 4 s linger; on failure the pill hides exactly like a cancellation (450 ms `ERROR_DISPLAY`); hub keeps `soravo:error` (status line shows it; `err-02` hub shows "Transcription came back empty"). `App.tsx` discards recorder+waveform on `error` (mic can no longer be stranded with the pill invisible). Error sound blip kept deliberately. Verified live (silence PTT, `err-02/03`).
8. Note: two moonshine "Fuck." DB rows (07:32Z/07:58Z) appeared during/near this session's PTT tests; at least one stray paste originated from session testing; target unverifiable from here. Flagged for the owner (VAD guard is a product decision, not built here).
9. **Visual refinement vs Wispr Flow (owner request, 2026-11-10).** Hands-free/processing capsule **112 → 100 px** (matches the reference); border 1 px alpha 0.14 → 0.18; horizontal padding 0 10 → 0 7 px; item gap 9 → 6 px; silence dots opacity 0.92 → 0.80; waveform bars `#f2f2ec` → `rgba(242,242,236,0.82)`. Measured after: compact x 924–995 / y 994–1021 (centre 960, gap 19 px); hands-free x 911–1008 / y 994–1021 (centre 960, gap 19 px); ✕ at (927, 1007) Ø ≈ 18 px, ✓ at (993, 1007) Ø ≈ 18 px. Tooltips still render on hover ("Cancel" / "Finish and paste"); cross-click discards the session and hides the pill; overlay confirmed transparent. Gates green: `npm run typecheck`, `vitest` 58/58, `cargo test --locked` 60/60, `npm run build` ok. Files changed: `pill.css`, `waveform.ts` only (no position/anchor/window/hotkey/FSM/audio changes).
10. **rdev keyboard hook delivers no keyboard events on this machine** (mouse hook works; keyboard events never logged even with the debug flag). Keyboard hotkeys still function via the hub's webview forwarder when the hub is focused. Recorded in `iteration-log.md`; not a code defect; owner to decide.
11. **Dashboard content container corners (owner request 2026-11-10).** `.hub-content` in `hub.css` had `border-radius: var(--hub-panel-radius) 0 0 0` — three corners were explicitly square. Fixed: all four corners now use `var(--hub-panel-radius)` (24 px), matching the upper-left. No layout, sidebar, card, palette or window changes. All four corners verified zoomed (screenshots `corner-tl2/tr2/bl2/br2-zoom.png`); typecheck clean; vitest 58/58; `npm run build` ok.

## Incomplete

1. Waveform react-to-speech — runtime verification impossible here (speaker→mic absent); needs owner's spoken test or virtual loopback.
2. ~~Empty transcript → error badge vs silent completion~~ — **resolved 2026-11-08** (error state removed; hub keeps the message).
3. DPI 125%/150% + multi-monitor placement — unverified (no scaled/multi display).
4. ~~Full `cargo test --locked`~~ — green (60/60 lib; `RUSTDOC` pinned to rustup MSVC).
5. `iteration-log.md`/`verification-report.md`/`continuation-status.md` committed; `progress.md` + pack `18_PROGRESS_AND_HANDOFF.md` updated.
6. CodeRabbit review — not run this session (quota); optional before merge.
7. Merge/push of the branch — **not** approved; do not merge.

## Latest test results

`npm run typecheck` clean · `npm test` 45/45 · `cargo test --locked` PASS (60/60 lib; RUSTDOC pinned to rustup MSVC) — re-verified after the error-state removal; the FSM unit tests still pass with the new transient error handling.

## Current blockers

- None hard. Acoustic mic verification and scaled/multi-monitor verification are environment-blocked.

## Exact next task

1. Owner-run spoken-word check of the waveform (bars must rise above floor) — needs a human voice or virtual loopback; cannot be done on this machine's speakers→mic path.
2. DPI 125%/150% and multi-monitor placement verification (needs a scaled or multi-monitor display).
3. Owner decision on the silence-hallucination paste issue (moonshine "Fuck." on silence; pipeline pastes unconditionally) — VAD/confirmation guard; not built here.
4. Regression sweep + docs final pass; keep `progress.md` + `Soravo_Fresh_Engineering_Pack/18_PROGRESS_AND_HANDOFF.md` current.

## Relevant screenshot paths

Reference (Wispr, not committed): `%TEMP%\opencode\pill-shots\02-pill-crop.png`, `07-handsfree.png`, `11-hover-tick.png`, `10-hover-cross-zoom.png`
Soravo baseline (this session): `%TEMP%\opencode\pill-evidence\base-00 … base-10`
Fix verification: `fix-06-ptt-fixed.png` (fresh PTT hold after restart: no tooltip), `fix-07-hf-hover-cross.png` (hands-free, cursor on ✕: tooltip renders), `fix-08-after-cancel.png` (post-cancel fresh PTT hold: no tooltip; capsule pixel-identical to baseline). `fix-01…fix-05` are pre-vite-restart artifacts showing the stale module; kept as evidence of the staleness failure mode.
Error-state removal verification: `err-01-hold.png`, `err-02-processing.png`, `err-03/04-after.png` (silence PTT after removal: pill hides with no red dot), `err-05-notepad.png` (hub frontmost; status line reads "Transcription came back empty").
