# Pill Overlay — Iteration Log

**Task:** P9-01 / PILL-OVERLAY-01 · **Branch:** `feature/PILL-OVERLAY-01-pill-overlay` (base `a9a5a8f`) · **Machine:** Windows 11, 1920×1080 @ 100% DPI, single monitor (`DISPLAY1`), work area 1920×1040.
Reference app: Wispr Flow 1.6.1400 (observation only; no binaries inspected). Soravo engine: CrispASR v0.8.43, unchanged throughout.

Screenshots are **not** committed. Reference captures live in `%TEMP%\opencode\pill-shots\` (named `NN-*.png`); Soravo baseline/verification captures live in `%TEMP%\opencode\pill-evidence\` (`base-*.png`, `fix-*.png`). Quoted measurements below are pixel-scans of those files.

## Status of the two owner-accepted milestones

| Milestone | Status |
|---|---|
| Double-tap hotkey activates hands-free recording | **Accepted by owner (manual)** — implemented in `dictation::Dictation` FSM (`src-tauri/src/dictation.rs`), driven by the rdev hook (`hotkeys.rs`) and the hub webview listener; deterministic unit tests green (`cargo test --lib` = 60 passed). |
| Pill visual appearance matches owner request | **Accepted by owner (manual)** — black #000 capsule, hairline, dots, hands-free ✕/✓ controls; appearance changes after acceptance: **none** (this session only fixed a tooltip-state bug, no visual change). |

## Iterations

### I1 — Reference measurement (2026-11-07, ~21:30)
Measured the reference overlay with `System.Drawing` pixel scans (scripts in `%TEMP%\opencode\pill-shots\*.ps1`): PTT capsule ≈ 73×30 px #000, 1 px ~18%-white hairline, bottom-center, 17 px above work-area bottom; hands-free ≈ 100×30 px with grey-warm ✕ circle + white ✓ circle; silence = dot row; processing = dots + 8-spoke spinner; completion = collapse to ~36×11 px outline outline; double-press semantics incl. auto-repeat never converting; release in hands-free is a no-op. Speech-level waveform could **not** be measured (speaker tones did not reach the mic; see reference-specification.md §Limitations). Deliverable: `reference-specification.md`. Audit of the old code: `current-implementation-audit.md` (defects: no hands-free, stuck-Transcribing, fake CSS waveform, unpositioned window, unguarded `submit_audio`, etc.).

### I2 — FSM + renderer rebuild (commit `70c467c`, ~22:49)
New pure FSM `dictation::Dictation` (PTT + hands-free, ≤400 ms double-press, tap-watch window, session ids, stale-event drops). `submit_audio` gated to `Processing`. Waveform on `<canvas>` from `AnalyserNode` tapped off the **same** `MediaStream` (no second stream). Capsule rebuilt (#000, hairline, 30 px target). Work-area-aware pill placement (`place_pill`, DPI-scaled 17 px margin, anchor setting `pill_anchor`, default `bottom-center`). Deterministic Rust unit tests (`dictation::tests::*`). CrispASR untouched.

### I3 — Capsule pixel fixes (commit `554abe5`, ~23:00)
Distinct bar rendering (bars not dots at speech floor); hands-free capsule widened to 112 px; overflow fixes. Pill window 120×56.

### I4 — Placement mode (commit `d5a2e6e`, ~23:03)
Full-screen placement window (`PlacementApp.tsx`): 9 zones, click-to-select, ghost-capsule pointer-drag with zone hit-testing, Esc cancels, `flash_pill_preview` feedback, persistence as `pill_anchor` (survives restart — verified by owner at 11:09–11:13: zone click moved pill to bottom-left, drag-and-drop worked, `soravo-settings.json` recorded `pillAnchor`).

### I5 — Owner manual testing + issue found (2026-11-07, 23:05–23:15)
Owner verified double-tap hands-free and capsule appearance; both accepted. Regression hunt found:
- **Defect: stuck hover → orphan tooltip.** After clicking ✕ (or ✓), `onMouseLeave` never fires because the button unmounts; `hover` stays `'cross'`; the "Cancel" tooltip renders above the capsule even with no buttons present, in every later state/session (reproduced with cursor far outside the pill, `base-06`, `base-10`). Violates the reference rule that no tooltip is permanently/always visible. **Fix (this session, `src/renderer/src/App.tsx`):** clear `hover` in an effect keyed on `[state, handsFree]` whenever the hands-free controls are not rendered. No visual change to the accepted capsule.
- **Capabilities:** placement window missing from `src-tauri/capabilities/default.json` windows list (worked anyway — app commands don't need window capabilities). Added `"placement"`.
- **Discrepancy (flagged, not changed):** an empty moonshine transcript on silence is routed to `Error` (`fail_current_session("Transcription came back empty")`), while the normative `interaction-state-machine.md` specifies empty transcript → `Processing → Completed` (silent success). Owner decision required — left unchanged to avoid silently changing user-facing behaviour. Owner saw red-dot error on silence during baseline capture (`base-02`).

### I6 — Baseline capture & measurements (this session, ~23:35–23:50, `%TEMP%\opencode\pill-evidence\`)
Machine: 1920×1080 @100% DPI, single monitor, work area bottom = 1040.

PTT (silent), `base-10`:
- Capsule: x **924→995** (72 px), y **994→1021** (28 px); centre x = 960 (screen-centred); bottom gap to work area = **19 px**; fill `0,0,0`; dots visible at y≈1007–1008.

Hands-free (silent), `base-04`:
- Capsule: x **905→1014** (~110 px measured on the arc rows; CSS width 112 px), y **994→1021**; centre ≈ 960/1007; ✕ circle left (warm grey ≈ rgb 87,84,78), ✓ circle right (white), dots between.

Processing/completed collapse not re-measured (previously observed: dots+spinner, then outline collapse). Error state: red dot (`base-02`), auto-hides.

Reference target vs. actual: capsule height renders **28 px** vs 30 px target (accepted by owner); bottom gap 19 px vs 17 px spec (within tolerance); PTT width 72 px vs ~73 spec ✓; hands-free width ~112 px vs 100 spec (owner-accepted widening for control spacing).

### I7 — Waveform data path (verified as far as physically possible here)
`App.tsx` taps the same `MediaStream` via `createWaveform` (`waveform.ts`) → `AnalyserNode` → 12-segment RMS+peak blend, power curve 0.72, attack 0.5 / decay 0.12 smoothing, `MIN_LEVEL` floor, DPR-aware canvas, drawn only while `state==='recording'`. Unit tests for the math: `tests/waveform.test.ts` (green). **Acoustic verification impossible on this machine:** speaker-played 500 Hz @ 31000 amplitude did not register on the default mic (consistent with the reference-capture finding for Wispr). Bars-react-to-voice therefore remains **unverified at runtime**; the path is structurally sound and unit-tested. Needs an owner check with speech, or a loopback/virtual audio device.

### I8 — Multi-monitor / DPI
`place_pill` performs all math in **physical px** on the pill's current monitor (fallback: primary), scales the 17 px margin by `monitor.scale_factor()`, positions against `monitor.work_area()` (never under the taskbar), for all 9 anchors. Placement window covers the monitor the hub is on. Single-monitor 100% DPI verified live; 125%/150% and multi-monitor paths implemented but **not yet run on scaled or multi-monitor hardware** — no such display available. P100 % measurements above are ground truth.

## Wrong turns / lessons

- **Do not** diagnose the pill's dots by thresholding "near-black" — the background app behind it renders its own dotted bar and a "Cancel"-family tooltip; both are indistinguishable from the outside without cursor-position and state controls. The pill's capsule is the **pure #000** element (x 924–995 PTT / 905–1014 hands-free); the background app's bars sit at abs y ≈ 969–1002 at x < 924.
- The "Cancel" tooltip seen on every earlier screenshot was **this app's own stale-hover tooltip**, not the background app and not a hover of the actual ✕ (it persisted with the cursor at (500, 400)).
- `npm run tauri:dev` cannot be used verbatim on this machine for Rust rebuilds — ambient `cargo` is chocolatey rustc 1.98.1 which fails `E0463` (no MSVC std installed); pin `RUSTC`/`CARGO` to rustup 1.90.0 `-x86_64-pc-windows-msvc`, load 2017 BuildTools `vcvars64.bat`, `CARGO_BUILD_TARGET=x86_64-pc-windows-msvc`, `CARGO_TARGET_DIR=Z:\codex-build-cache\PILL-OVERLAY-01-msvc` (see `%TEMP%\opencode\pill-build.bat`, `pill-run.ps1`).
- Restart protocol: kill `soravo.exe` + the `cargo run` chain only; vite dev server (port 5173) serves the worktree live, so a fresh app start picks up renderer changes without a vite restart.
- Speaker tones do not reach this machine's mic — don't burn time trying to "prove" the waveform that way; use unit tests + owner speech check.

## Known discrepancies / open items

1. Empty transcript → `Error` (red dot) vs normative doc's `Completed`. Owner decision pending. (`I5`)
2. Capsule renders 28 px tall vs 30 px reference (owner-accepted).
3. Waveform react-to-speech unverified at runtime (no acoustic path on this machine).
4. DPI 125%/150% and multi-monitor placement unverified (no scaled/multi display).
5. `cargo test --lib` green (60); full `cargo test` (incl. engine-dependent tests) not re-run — engine tests skip when model missing; last full run state unknown. Vitest 45/45 green; `tsc --noEmit` clean.
6. `interaction-state-machine.md` names `cancel_recording` as both alias and command; observed deltas vs implementation: `finish_recording` exists (used by ✓); doc's `soravo:audio-level` intentionally omitted (renderer-side AnalyserNode only) — as designed in the doc.
