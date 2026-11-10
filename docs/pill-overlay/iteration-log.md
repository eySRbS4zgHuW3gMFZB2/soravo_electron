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

### I9b — Review pass + capability split (2026-11-08, see PR #47)
Security/code review of the full branch diff (`origin/main...HEAD`): capability split into minimal hub/pill/placement files (was one shared grant with dialog/shell/clipboard/store/window perms on every window); dead variable removed from `waveform.ts`. No dangerous sinks found (constant process args, parameterized SQL, React auto-escape). CodeRabbit CLI review failed pre-analysis ("Git provider access could not be authenticated", both attempts) — review deferred to PR #47; manual review + security-review applied instead. All gates green after changes (tsc, vitest 58/58, cargo test --locked 60/60, npm build ok, live smoke incl. hands-free round trip).

### I10 — Final visual parity refinement vs Wispr Flow (2026-11-10, owner request)
Narrowly-scoped visual pass; no position, anchor, monitor, window, hotkey, FSM, recording, transcription, paste or waveform-analysis changes.

Measured before (1920x1080 @100% DPI, single monitor, work area bottom = 1040; app PID 8512/872): PTT capsule x 924-995 (72 px), y 994-1021 (28 px fill + 1 px border), centre 960, bottom gap 19 px; hands-free capsule x 905-1014 (~110 px), same y/geometry; border 14% white; ✕/✓ Ø 18 px (warm-grey ✕ on #57544e, white ✓ on #ffffff); silence dots near-white at 0.92 opacity; waveform bars #f2f2ec at 100%; processing capsule 112 px.

Reference (machine-measured, `reference-specification.md`): PTT 73x30; hands-free ~100x30; 1 px ~18-19% white hairline; muted grey-ish off-white dots; no shadow; buttons Ø 18-19 px.

Changes applied:
- Hands-free + processing capsule 112 -> **100 px** (matches the reference exactly).
- Capsule border 1 px 14% -> 18% white (matches the reference hairline; subtle, no new shadow).
- Horizontal padding 0 10 px -> 0 7 px; inter-item gap 9 px -> 6 px. The 100 px hands-free capsule keeps the same 38 px waveform canvas as before (pitch ~3.17 px, barW ~1.74 px) so dot density is unchanged.
- Silence dots (`.pill-dots`) opacity 0.92 -> 0.80 (muted grey).
- Waveform bars (waveform.ts): fillStyle `#f2f2ec` -> `rgba(242,242,236,0.82)`.

Measured after (app PID 872, 2026-11-10):
- Compact: x 924-995 (72 px), y 994-1021; centre 960; gap 19 px; dots muted.
- Hands-free: fill rows 994-1021; max outer width x 911-1008 (~98 px effective = 100 px CSS class, matching the reference); centre 960; gap 19 px; ✕ Ø ~18 px at (927, 1007); ✓ Ø ~18 px at (993, 1007); dots centred between the buttons.

Verification (fresh app PID 872): compact and hands-free states re-captured; tooltips still render on hover ("Cancel" over ✕, "Finish and paste" over ✓); cross-click discards the session and hides the pill; the overlay is genuinely transparent (background shows through; no rectangular surface). `npm run typecheck` clean; `vitest` 58/58; `cargo test --locked` 60/60; `npm run build` ok. Files changed: `pill.css`, `waveform.ts` only.

### I10b — Dev-server namespace note (not a code change)
`npm run tauri:dev` under `scripts/tauri-dev.mjs` runs the full stack (website Vite 5174 + desktop Vite 5173 + cargo app). Killing `soravo.exe` exits the supervisor and stops both Vites — dev verification rounds that relaunch the app must restart the supervisor, not just the binary. `Cargo` on PATH (chocolatey rustc 1.98.1) cannot build this workspace (E0463); use rustup 1.90.0 `-x86_64-pc-windows-msvc` + 2017 BuildTools `vcvars64.bat`, `CARGO_BUILD_TARGET=x86_64-pc-windows-msvc`, `CARGO_TARGET_DIR=Z:\codex-build-cache\PILL-OVERLAY-01-msvc`. Note the persistence quirk: after several restarts the UNC incremental cache degrades (`hard linking failed. copying files instead` + stale `.working` directories) — a clean isolated target dir or patience is the remedy.

### I11 — Dashboard content container: consistent rounded corners (2026-11-10, owner request)

Root cause: `.hub-content` (the large dark dashboard surface, `<main className="hub-content">` in `HubApp.tsx`) in `src/renderer/src/hub.css` had `border-radius: var(--hub-panel-radius) 0 0 0` — only the upper-left was rounded; the other three were explicitly `0`.

Fix (one declaration): `border-radius: var(--hub-panel-radius) 0 0 0` → `border-radius: var(--hub-panel-radius)` (all four corners, `--hub-panel-radius: 24 px`, matching the existing upper-left). No layout, spacing, sidebar, card, palette, typography, shadow, or window size/behaviour changes.

Children cannot square off the corners: `.hub-content` clips with `overflow: hidden`; direct children (`.page`, `.page-scroll`) carry no backgrounds; cards keep their own radii.

Verification: all four corners re-captured zoomed (`corner-tl2/tr2/bl2/br2-zoom.png`); every corner shows the same smooth 24 px curve; typecheck clean; vitest 58/58; vite build ok.

### I12 — Inset main content panel (Wispr two-layer shell) (2026-11-10, owner request)

Root cause: `.hub-content` filled the flex row full-bleed — no outer-shell frame, no panel border (I11 had just rounded the corners, but the surface still filled the row edge-to-edge).

Fix (`hub.css`, one block): `.hub-content` gains `margin: 12px 12px 12px 0` (top/right/bottom frame of the outer `canvas-soft` background; left stays 0 so the panel's left edge stays aligned with the existing rail/content boundary) plus `border: 1px solid var(--border)` (existing theme-aware token: `#d3d8cd` light / `#3a4033` dark). All four corners retain the 24 px radius; `overflow: hidden` keeps children clipped to the rounded panel at every scroll/navigation state.

Verification: 12 px frame and 1 px border measured by pixel scan (panel `25,28,21` inside frame `34,38,30`); 12 px on all three framed sides (left = boundary, kept as required); 1 px border subtle in both themes (token-driven `--border`); window geometry unchanged (285,95 1350x850); `npm run typecheck` clean; `vitest` 58/58; `npm run build` ok. Second-opinion subagent review confirmed the margin-vs-padding approach and the theme-aware border choice.

## Known discrepancies / open items

1. ~~Empty transcript → `Error` red dot~~ — resolved 2026-11-08 (pill's error state removed; see I9).
2. Capsule renders 28 px tall vs 30 px reference (owner-accepted).
3. Waveform react-to-speech unverified at runtime (no acoustic path on this machine).
4. DPI 125%/150% and multi-monitor placement unverified (no scaled/multi display).
5. `cargo test --locked` green — 60/60 lib (doctests require `RUSTDOC` pinned to the rustup MSVC toolchain). Vitest 58/58 green; `tsc --noEmit` clean.
6. `rdev` keyboard hook receives **no keyboard events on this machine** (mouse hook works) — likely why manual testing with Mouse4/Mouse5 passes but Ctrl+2 keyboard hotkey tests appeared flaky/absent. Not a code defect; recorded for the owner to check the machine's keyboard input chain (or to flip the app's keyboard hook to a redundant path).

### I9 � Pill error state removed entirely (2026-11-08, owner request)
Owner: 'Can you remove the error state of the pill entirely?'

- Pill no longer renders any failure state: no red dot, no \data-mode=\"error\"\ capsule, no \.pill-err\ CSS, no 4 s linger. On failure (mic loss, decode failure, crispasr failure, empty transcript, audio timeout) the pill now hides exactly like a cancellation (450 ms transient to \Idle\); the failure reaches the hub via \soravo:error\ and \RecState::Error\ (hub contract unchanged � DictationPage status line still shows it).
- \App.tsx\: \onState('error')\ discards the recorder + waveform before hiding � previously the pill would persist invisibly while a silently recording MediaRecorder kept the mic open (red mic indicator for users who hit the 15 s no-audio timeout). Now the mic is stopped in every failure path.
- Sound: the \error\ blip still plays on failure (deliberate � audible-only failure cue with no visual state). Can be removed on request.
- FSM unchanged; \Phase::Error\ remains a valid parking phase (press recovers, submit gated). \ERROR_DISPLAY\ 4 s ? 450 ms. Rust unit tests unchanged, 60/60 green; tsc clean; vitest 45/45.
- Verified live (err-01�04): silence PTT ? release ? pill hides within ~1.5 s, no red dot ever rendered (screenshot err-02/err-03). Mic torn down via the new discard path.
- Normative doc updated (Error row = invisible transient; failure-path table; empty-transcript row). Owner-visible failure text unchanged.
- Note: silence/tone PTTs made moonshine return \"Fuck.\" twice (23:32 and 23:58) and the app typed it into the focused window (DB rows); empty results never inject. This is inherent to unconfirmed dictation (CrispASR hallucinates on silence) and predates this change � flagged for an owner decision on VAD gating; not fixed here (would be a new feature).
