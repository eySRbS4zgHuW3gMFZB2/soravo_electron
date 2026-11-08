# Pill Overlay — Verification Report

**Task:** P9-01 / PILL-OVERLAY-01 · **Date:** 2026-11-07 · **Machine:** Windows 11, 1920×1080 @ 100% DPI (LogPixels 96), single monitor `DISPLAY1`, work area 1920×1040 · **Branch:** `feature/PILL-OVERLAY-01-pill-overlay` (base `a9a5a8f`) · **Engine:** CrispASR v0.8.43 (untouched).

Screenshots referenced by filename (`%TEMP%\opencode\pill-evidence\` unless noted); they are not committed. No >4–6 images were attached to any single model request in this session; historical captures were re-used as files, not re-analysed en masse.

## Code-level gates (all run in this worktree)

| Gate | Result |
|---|---|
| `npm run typecheck` (`tsc --noEmit`) | **PASS** (clean) |
| `npm test` (vitest, root) | **PASS** — 9 files / 45 tests |
| `cargo test --lib --locked` (rustup 1.90.0 MSVC, vcvars64, isolated target dir) | **PASS** — 60 passed, 0 failed, incl. `dictation::tests::*` FSM suite |
| Full `cargo test` (incl. engine/model-dependent) | **NOT RUN** — model present for the default tiny model; not re-run in this session. Record honestly as unverified. |
| `git status` clean before this session's edits | **PASS** (tree was clean at recovery) |

Note: ambient `cargo` (chocolatey rustc 1.98.1) **cannot** build this workspace (`E0463: can't find crate for core`, MSVC std absent). All Rust work used the pinned rustup 1.90.0 `-x86_64-pc-windows-msvc` toolchain + 2017 BuildTools `vcvars64.bat` + `CARGO_TARGET_DIR=Z:\codex-build-cache\PILL-OVERLAY-01-msvc`.

## Runtime verification (single monitor, 100% DPI)

| Check | Result | Evidence |
|---|---|---|
| PTT hold shows dots capsule, no buttons, no tooltip | **PASS with defect found** | `base-01`; dots visible, capsule pure #000 x 924–995 y 994–1021 |
| Hands-free double-press enters hands-free during hold | **PASS** (owner-accepted) | `base-03`, `fix-01` region; X and ✓ rendered, dots between |
| Hands-free X discards and hides pill | **PASS** (owner-accepted at 11:10; re-confirmed this session) | `base-05` — pill gone after cross click |
| Hotkey press in hands-free / tick finishes | **Owner-verified earlier** (63/64 captures); not re-run (avoids pasting into arbitrary focused window) | `%TEMP%\opencode\pill-shots\63-post-tick*.png` |
| Release in hands-free does not stop recording | **PASS** (by construction + FSM unit tests) | `dictation::tests::release_in_hands_free_noop` |
| Single press never enters hands-free; auto-repeat never converts | **PASS** (FSM unit tests) | `double_press_*`, `autorepeat_never_converts`, `triple_press_finishes_once` |
| Placement mode: zones, drag, click-select, persistence | **PASS** (owner manual, 11:09–11:13; not re-run to avoid churn) | `%TEMP%\opencode\pill-shots\56/57/58/65/66*.png`; `soravo-settings.json` shows `pillAnchor: bottom-center` after restore |
| Place pill never covers taskbar; DPI-scaled margin | **PASS** by code inspection + 100% live measurement (19 px gap, work-area 1040 honoured) | `place_pill` `src-tauri/src/lib.rs`; `base-10` |
| Empty transcription routes to error badge | **OBSERVED** (red dot, `base-02`) — behaviour contradicts normative doc (see §Discrepancies) | `base-02` |
| Crash/compat with running background apps | None observed; whisper of background chat app rendering its own dotted bar behind the pill | `base-10` |
| **Stale tooltip defect** | **FOUND + FIXED in this session** | see below |

### Stale-hover tooltip defect — found, fixed, VERIFIED

- **Defect:** `hover` survived button unmount (`onMouseLeave` never fires for an unmounted button), so the ✕/"Cancel" tooltip rendered above the capsule with **no controls present**, persisting across states and sessions (reproduced with cursor at (500,400), `base-06`, `base-10`). Violates the reference rule that no tooltip is permanently visible.
- **Fix:** `src/renderer/src/App.tsx` — effect keyed on `[state, handsFree]` clears `hover` whenever the hands-free controls are not rendered. Zero visual change to the accepted capsule (re-measured after the fix: PTT capsule x 924–995 / y 994–1021, pixel-identical to baseline; `fix-08`).
- **Verification (live, single monitor):** fresh PTT hold with cursor far outside the pill → **no tooltip** (`fix-06`); hands-free with cursor parked on ✕ → tooltip renders (`fix-07`); click ✕ to cancel → fresh PTT hold → **no tooltip** (`fix-08`). Note: the running Vite dev server on port 5173 must be **restarted after renderer edits** — its watcher does not invalidate modules on this machine's folder (stale transformed `App.tsx` was served at first; verified by fetching the module before/after restart). After the restart, the fix is live and the check passes end-to-end.

## Discrepancies (documented, not changed without owner sign-off)

1. **Empty transcript → red-dot error** (`fail_current_session("Transcription came back empty")`) vs. normative `interaction-state-machine.md` (empty → `Completed`, silent). Owner decision needed.
2. Capsule renders **28 px** tall vs 30 px reference target (owner-accepted current look).
3. Waveform reacting to **real speech** unverified on this machine (speaker→mic coupling absent; consistent with reference-capture finding). Path: AnalyserNode on shared `MediaStream`, 12 bars, attack/decay smoothing; math unit-tested. Needs an owner spoken-word check or virtual loopback device.
4. **125%/150% DPI and multi-monitor placement unverified** — no scaled/multi-monitor display attached. Code is physical-px + `scale_factor()` based; untested at runtime.
5. Placement window was absent from `capabilities/default.json` windows list — added in this session (`"placement"`). It worked before; listing is correct hygiene, needs regression check that placement still opens.

## Regression protocol used

Baseline captured **before** any change this session (`base-00…base-06`, `base-10`). After the hover fix and restart: re-run hands-free double-press → park cursor on ✕ → click ✕ (cancel) → fresh PTT hold → tooltip must **not** render. Compare against `base-*` crops; capsule must remain x 924–995 / y 994–1021 (PTT) and ≈905–1014 (hands-free), y 994–1021, gap ≤ 19 px.

## Sign-off

Not signed off for release. Remaining: owner spoken-waveform check; DPI/multi-monitor check; empty-transcript decision; tooltip fix live confirmation; full `cargo test`.
