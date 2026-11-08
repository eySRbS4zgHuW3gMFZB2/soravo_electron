# Pill Interaction State Machine

**Task:** P9-01 · Companion to `reference-specification.md` (Wispr Flow behaviour) and `current-implementation-audit.md` (why this replaces the ad-hoc design).
**Normative.** The Rust FSM in `src-tauri/src/dictation.rs` implements exactly this; `hotkeys.rs` (rdev hook) and the hub webview both feed it raw `press`/`release` events. CrispASR is untouched.

## Interaction modes (exactly two)

- **Push-to-talk (PTT):** hold hotkey → recording; release → stop + transcribe + paste; pill hides on completion.
- **Hands-free:** rapid **double-press** (two physical presses with an intervening release, ≤ `DOUBLE_PRESS_MS = 400` ms apart) → exactly **one** session enters hands-free; recording persists after release; **X** cancels and discards; **✓** (or pressing the hotkey) finishes, transcribes and pastes.

Forbidden: single-click persistent recording; any third mode; duplicate sessions; duplicate transcription jobs; duplicate pastes.

**Legacy `hold_to_talk` setting:** preserved in storage/UI for compatibility, but no longer selects a gesture mode — making it choose "toggle on single click" would violate the two-mode rule. Both settings now mean: hold = PTT; double-press = hands-free. (Owner decision flagged; behaviour change documented in `progress.md`.)

## States

| State | Pill | Entry | Exit |
|---|---|---|---|
| `Idle` | hidden | start | `HotkeyPress`, or idle timeout from a transient state |
| `PushToTalkPending` | visible, bars, no buttons | `HotkeyPress` in `Idle`/`Error` | mic start OK → `PushToTalkRecording`; mic failure → `Error` |
| `PushToTalkRecording` | visible, bars, no buttons | from pending | `Release` → `Processing`; qualifying double-press → `HandsFreeRecording`; cancel → `Cancelled` |
| `HandsFreeRecording` | visible, bars + ✕/✓ | qualifying double-press | `✓` / `HotkeyPress` → `Processing`; `✕` / `HotkeyPress?` → see below; `Cancelled` |
| `Processing` | visible, dots + spinner | from recording states | submit OK → `Completed`; failure/timeout → `Error` |
| `Completed` | collapse-to-outline ~250 ms → hide | submit OK | transient → `Idle` |
| `Cancelled` | fade ~200 ms → hide | cancel in any recording state | transient → `Idle` |
| `Error` | visible, error glyph; pill persists ≤ 4 s then hides | start/transcribe/timeout failure | timeout → `Idle`; `HotkeyPress` → new session (`PushToTalkPending`) |

In `HandsFreeRecording`, `HotkeyPress` = finish (✓ semantics, per reference tooltip "Press … to finish and paste"). Cancellation is only via ✕.

## Sessions and stale-event protection

- Every session gets `session_id: u64` (monotonic, `AppState.session_gen`).
- `soravo:state` remains `"idle" | "recording" | "transcribing" | "error"` (hub contract unchanged). The pill additionally consumes **`soravo:hands-free`** (`{ session, on }`) and **`soravo:record-command`** (now `{ command: "start"|"stop"|"cancel", session }`).
- The frontend drops any `record-command` whose `session` ≠ its current session. Native side is authoritative regardless.
- `submit_audio` is accepted **only** in `Processing` (`Transcribing`); otherwise it is dropped with a logged telemetry event (`soravo:error` is *not* emitted for stale drops — silent no-op + log). This kills the stuck-`Transcribing` and post-cancel-overwrite bugs.
- Hide scheduling uses the existing generation ticket (`hide_gen`); a hide is only valid for the session that scheduled it.
- The 15 s no-audio timeout now **resets `RecState` to `Error`** (and hides the pill) instead of emitting an error string into the void.

## Input handling rules (all deterministic; no settling sleeps)

1. **Modifiers** are tracked separately (as today). Only the trigger edge matters.
2. **Physical double-press** = `Press` … `Release` … `Press` where the second `Press` occurs ≤ 400 ms after the first `Release` *in the same session*. `Press` without an intervening `Release` is auto-repeat and **never** converts PTT → hands-free.
3. **PTT release** fires only in `PushToTalkRecording`/`PushToTalkPending` and only for the trigger key (modifier order irrelevant).
4. **Release in `HandsFreeRecording`** is a no-op.
5. **Press in `Processing`** is ignored. **Press in `Completed`/`Cancelled`** is ignored until `Idle`.
6. **Press in `Error`** clears the error and starts a new session.
7. **Three rapid presses** (P–R–P–R–P, each ≤ 400 ms): P1 starts PTT, P2 (after R) converts to hands-free, P3 finishes → `Processing`. One session, one transcription, one paste.
8. **Slow double-press** (> 400 ms): P1 starts PTT; release stops → `Processing`; P2 ignored (in `Processing`). No second session, no hands-free.
9. **Hotkey during `Cancelled`** (< transient): ignored; transient ends, `Idle`.
10. Both delivery paths (rdev hook; hub webview listener) call the **same** FSM functions (`dictation::press` / `dictation::release`) — no mirrored logic. The pill window handles **no** key events.

## Event/command contract (renderer ↔ Rust)

| Surface | Name | Payload |
|---|---|---|
| command | `hotkey_press` / `hotkey_release` | `()` → `Result<(), String>` |
| command | `cancel_recording` (renamed/aliased `cancel`) | `()` — discards current session |
| command | `finish_recording` (✓ / hotkey-finish) | `()` — `Processing` if hands-free/PTT recording |
| command | `submit_audio` | `{ wav: number[], durationMs }` — gated on `Processing` |
| command | `get_state` | `RecState` |
| command | `get_hands_free` | `{ handsFree: bool, session: u64 }` |
| event | `soravo:state` | `RecState` (unchanged) |
| event | `soravo:session` | `{ id: u64, handsFree: bool }` |
| event | `soravo:record-command` | `{ command: string, session: u64 }` |
| event | `soravo:audio-level` | `{ bars: number[] }` (≈20 Hz, optional spike path; primary waveform is renderer-side AnalyserNode — see note) |

**Waveform data path:** the pill taps the *same* `MediaStream` used for `MediaRecorder` via an `AnalyserNode` — no second mic stream, no fake data, no VAD-as-amplitude. Bar heights are computed from time-domain samples (RMS per segment + peak blend), smoothed with attack/decay. `soravo:audio-level` is intentionally **not** required; if the renderer path proves enough, it is omitted (one data path only).

## Failure paths

| Failure | Transition | User-visible |
|---|---|---|
| `getUserMedia` denied/unplugged | `PushToTalkPending` → `Error` | error glyph, auto-hide 4 s |
| `MediaRecorder` error | → `Error` | same |
| Decode/resample failure | → `Error` (submit gated path) | same |
| crispasr non-zero exit | `Processing` → `Error` | error glyph |
| Empty transcript | `Processing` → `Completed` (silent success; matches current empty-text behaviour of inserting nothing — actually current code inserts only non-empty; keep) | pill completes |
| Paste (SendKeys) failure | `Processing` → `Completed` + `soravo:error` "text copied, paste failed"? | current behaviour: error emitted, stays Completed (text in clipboard) |
| App quit mid-recording | session dropped; temp wav cleaned; no paste | n/a |

## Tests (deterministic, no sleeps)

Rust unit tests in `dictation.rs` with injected `Clock`:
`press_starts_ptt`, `release_stops_ptt`, `modifier_order_irrelevant`, `double_press_enters_hands_free`, `double_press_slow_gap_does_not`, `autorepeat_never_converts`, `triple_press_finishes_once`, `release_in_hands_free_noop`, `hotkey_press_in_hands_free_finishes`, `cross_discards`, `tick_completes`, `press_in_processing_ignored`, `submit_only_in_processing`, `stale_session_events_dropped`, `error_press_recovers`, `timeout_resets_to_error`, `completion_transitions_to_idle`, `hold_path_end_to_end`.
Target: all green + `cargo test` suite green + `vitest` green.
