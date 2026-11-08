# Soravo Pill — Current Implementation Audit

**Task:** P9-01 · **Audited:** 2026-11-07 · **Base:** `origin/main` @ `a9a5a8f` (worktree `.worktrees/PILL-OVERLAY-01-pill-overlay`, branch `feature/PILL-OVERLAY-01-pill-overlay`).
**CrispASR v0.8.43 was not modified.** Findings sourced from two read-only subagent audits (renderer + Rust), both re-verified against the tree.

## Architecture as found

- `tauri.conf.json` declares the pill window (`pill`, 210×56, frameless, transparent, `alwaysOnTop`, `skipTaskbar`, `focusable:false`, starts hidden) and the hub (1350×850). No other overlay window exists.
- The pill's webview (`App.tsx`) owns microphone capture (`getUserMedia` → `MediaRecorder`), converts to 16 kHz mono WAV (`audio.ts`), and submits via the `submit_audio` command. Rust never touches the mic.
- Rust (`lib.rs`, 114 KB) owns state (`Mutex<RecState>`: `Idle|Recording|Transcribing|Error`), window show/hide (`schedule_pill_hide`, generation-ticketed), the transcription pipeline (spawn `crispasr` → post-process → DB → paste), hotkey hook (`hotkeys.rs`, `rdev::listen`), settings, and all Tauri commands.
- Events are **broadcast** (`app.emit`) — `soravo:state`, `soravo:record-command` (start/stop/cancel), `soravo:transcript`, `soravo:error`, `soravo:data-changed`, … The hub listens; so does the pill.
- Placement: **there is none.** The pill is never positioned at runtime; `set_height` (the only sizing/positioning command, dead code — never invoked by the renderer) would centre it horizontally and pin it 28 px above the work-area bottom, clamps height to ≥ 84 px (contradicting the 56 px design), and skips placement entirely if `current_monitor()` returns `None`. Bottom gap, width and all math are physical px with no DPI scaling.
- Capability `default.json` grants the pill `allow-set-focus`, `allow-set-always-on-top`, `allow-set-size`, `allow-set-position`, … — broad and unused.

## Defects inventory

### Recording lifecycle / state machine

1. **No hands-free mode exists at all.** The only gesture logic is `hold_to_talk` setting: press starts, trigger-release stops; otherwise toggle. Double-press detection (reference parity) is absent.
2. **Stuck `Transcribing` wedge:** the 15 s no-audio timeout emits `soravo:error` but never resets `RecState` or hides the pill; every later press is swallowed by `start_recording`'s `Idle|Error`-only guard and `toggle`'s `Transcribing` ignore — dictation is dead until restart.
3. **Error path desync:** the 4 s error timer emits `soravo:state=idle` to the frontend without writing `Idle` to the native mutex — native state stays `Error` while UI shows idle.
4. **`submit_audio` has no `Transcribing` guard** — callable while Idle/Recording; a stale submission overwrites state even after `cancel`. No session identifier exists.
5. **Empty-wav error path doesn't hide the pill** (all other error exits do) — pill lingers on mic-open failure.
6. `toggle`'s 300 ms debounce is the only auto-repeat/flash guard; rdev emits repeated `KeyPress` for held keys, and hold-mode relies on implicit no-ops.
7. `schedule_pill_hide` (generation ticket) is the only stale-event protection; it does not cover audio submission, hides after cancel (2500 ms — arbitrary delay), or the completion path.
8. Backend `hotkeys.rs` hook and hub JS both implement hold-to-talk (mirror logic); the pill adds a third, cruder path (any-keyup → `toggle()`), effectively dead because the pill is `focusable:false` — but it would toggle recording from any key release if it ever fired.
9. `settingsToTauri` (renderer) is dead and drops `holdToTalk`; `soravo:toggle-hotkey` is listened to but never emitted; the hub-scratchpad jump-matcher and Scratchpad matcher have the raw-`e.key` bug for `Space`.

### Window / overlay

10. Pill never positioned (see above); on first show it lands at the OS default location, arbitrary on multi-monitor setups.
11. `focusable:false` correct; `alwaysOnTop` set only at creation, never re-asserted; no monitor/DPI-aware work-area math; 28 px margin not scaled; bottom positioning uses the *pill's current* monitor only.
12. Width is fixed config 210 px regardless of content; CSS `.soravo-mini` is 56 px tall; shadow (`0 12px 40px`) is clipped by any window hugging the pill.
13. Dark-theme hazard: if `data-theme='dark'` ever reaches the pill window, `.soravo-mini` flips to near-white with white text (white-on-white).

### Frontend

14. **Waveform is fake**: six CSS-animated `<i>` bars (staggered `@keyframes bars`), no `AnalyserNode`, no microphone amplitude anywhere. The spec mandates bars driven by real microphone data.
15. `.live-bars` track is the brand lime regardless of state; AGENTS.md warns it's marks-not-fills — fine here, but it violates reference parity (near-white bars).
16. `.soravo-mini` paints `var(--soravo-ink)` (#0e0f0c) — reference capsule is pure #000 with a 1 px hairline.
17. `App.tsx` seeds state `'idle'` — one-frame flash; `setHeight` never called; `durationMs` wall-clock not decoded; cancel button active in every state; keyup any-key handler (see 8).
18. IPC payload: full PCM as a JSON array (`Array.from`) — inefficient but functional; out of scope to optimise unless trivially safe (leave as is; note it).
19. Reduced-motion users get frozen bars (CSS `prefers-reduced-motion` clamps animation) — a canvas waveform fixes this naturally.
20. `-webkit-app-region: drag` is an Electron convention; Tauri's mechanism is `data-tauri-drag-region` — current drag affordance in the pill is unverified/ineffective; no JS drag fallback exists.

### Capability / config

21. Pill granted window permissions it doesn't need (`allow-set-focus`, …) — tighten to what the reconstruction uses.

## What is worth preserving

- The Rust transcription pipeline end-to-end (`submit_audio` → crispasr → cleanup → snippets/vocabulary → DB → inject) — only its **guards** change, never the engine.
- Idempotent `start_recording`/`stop_recording` core; single-instance plugin; `textarea_focused` hook stand-down (with its clear-on-unmount fix already present).
- `hotkeys.rs` binding parser and rdev hook architecture (per AGENTS.md, rdev::listen must not be replaced with a hand-written WH_KEYBOARD_LL + pump).
- `App.tsx` MediaRecorder → WAV → `submitAudio` flow (re-used as-is; waveform taps the same `MediaStream` via `AnalyserNode`).
- Generation-ticketed `schedule_pill_hide` pattern (replace the fixed 2500/4000 ms delays with state-driven hides where possible).
- Tauri config transparency stack for the pill window (transparent, frameless, topmost, skip-taskbar, focusable false).

## Root causes of previous pill failures

1. **No real audio data path** — the waveform was CSS theatre; any "reacts to voice" claim was false.
2. **No placement code executed at runtime** — anchoring was designed in Rust but never wired to a UI, and `set_height` contradicts the design (84 px clamp vs 56 px pill, no DPI, dead call site).
3. **No explicit two-mode interaction model** — hold-to-talk and a global toggle debounce coexisted; auto-repeat, double-press and rapid sequences were unspecified, so failures were nondeterministic.
4. **State machine leaks** — stuck Transcribing, error/idle desync, unguarded submit — produced "stuck pill" reports that no amount of CSS could fix.
5. **Design drift** — tokens flipped by `hub.css` dark theme, clipped 40 px shadow on a 56 px window, no max-width for hands-free controls, and a fake-but-prominent "Soravo" hint in idle state.
6. **Verification gap** — earlier iterations tuned pixels without measuring the reference; this reconstruction measures first.

## Components to replace

- `.soravo-mini` visual layer → new capsule component (canvas bars + CSS transitions).
- Fake `.live-bars` → AnalyserNode-driven canvas waveform.
- Hotkey gesture FSM → new shared Rust `dictation.rs` FSM invoked from both the rdev hook and new native commands (`hotkey_press`/`hotkey_release`) used by the hub listener; pill keeps no key handling.
- `set_height` → proper `place_pill`/`position` logic with DPI/work-area math + new placement-mode window.
- `soravo:record-command` start/stop/cancel + `toggle` → retained for compatibility but superseded by FSM commands; pill renders from `soravo:state` + new `soravo:hands-free` event.

## Verification commands used

Two read-only subagent audits (no edits made by them); line references above are accurate as of tree `a9a5a8f`.
