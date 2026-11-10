# Wispr Flow Pill — Reference Specification

**Task:** P9-01 / PILL-OVERLAY-01 · **Captured:** 2026-11-07, 21:30–21:45 local · **Machine:** Windows 11, 1920×1080 @ 100% DPI (LogPixels = 96, single monitor `DISPLAY1`, work area 1920×1040, taskbar 40px bottom) · **Reference app:** Wispr Flow 1.6.1400 (Squirrel install at `%LOCALAPPDATA%\WisprFlow\app-1.6.1400`)

> **Licensing note.** Reference screenshots were taken of the reference application for internal engineering measurement. They are **not committed to this repository** (the repository is public; distributing the third party's rendered UI is not necessary for implementation). All measured values are recorded here. To re-capture, install Wispr Flow, focus any text field, and hold/double-press the dictation hotkey.

## Tool and method statement

- **Visible observation:** real screenshots via a PowerShell `System.Drawing.CopyFromScreen` harness (`shot.ps1`), pixel-level measurement via `GetPixel` scans (`.NET`), zoom via nearest-neighbour rescale. All captures at native 1920×1080, no scaling unless marked "zoom ×N".
- **REA:** no REA lane materially applies to a Windows-native/Electron target for *this* observation task — REA's window/UI lanes target macOS (`observe_native_ui`, Mach-O-bound) and Android/adb, and its Electron CDP lanes require an exposed loopback CDP endpoint the reference app does not provide by default. REA was therefore **not** used for the reference app; observation was done with native Windows tooling. REA **was** configured and available; see the verification report for what it established about Soravo (nothing additional that source-level audit did not already establish — see §REA/Ghidra).
- **Ghidra:** 12.1.4 at `C:\Program Files\Ghidra\ghidra_12.1.4_PUBLIC`. **Not run.** The Soravo side of this project has complete source available; decompiling the reference binary is not licensed by the reference app's terms and is not needed for behavioural parity. No Wispr Flow binary was disassembled, decompiled or inspected beyond file metadata (`ProductVersion` 1.6.1400) and directory listing of the install tree.
- **Vision model:** every captured screenshot was inspected by the implementing agent (this session's vision-capable model) — dimensions quoted below are measured, not eyeballed.
- **Limitations:** the microphone did not register a 440 Hz/880 Hz speaker-played tone during capture (Wispr Flow's server-side VAD showed only the silence indicator). **Speech-level waveform behaviour is therefore unmeasured** — see Open uncertainties. Similarly, the error state and the placement/reposition UI could not be exercised without either speaking or entering the reference app's own settings (blocked by foreground-lock on this desktop; see below).

## Captured states and what they show

| # | State | File (local, not committed) | Observations |
|---|-------|------------------------------|--------------|
| 01 | Idle desktop + Flow hub open | `01-hold.png` (full screen) | No pill visible when idle. Pill only appears during/after dictation. Tray icon present while Flow runs. |
| 02 | Push-to-talk, **silence** | `02-pill-crop.png`, `24-ptt-hold.png` (+zoom) | Black capsule bottom-center. Row of small light dots (silence indicator). |
| 03 | Hands-free, **silence** | `07-handsfree.png`, `08/09-handsfree*` | Wider capsule. Left: X in grey/brown circle. Right: ✓ in white circle. Dots between them. Tooltip on center hover: "Press Mouse 4 to finish and paste". |
| 04 | Hover cross | `10-hover-cross*`, `12-hover-cross-full.png` | Tooltip "Cancel". Cross circle lightens slightly. |
| 05 | Hover tick | `11-hover-tick.png` | Tooltip "Finish and paste". |
| 06 | Push-to-talk released, **processing** | `06-processing-1.png` | Capsule remains (~100px). Dots persist on the left; a spinner (8-spoke asterisk, light periwinkle/white) appears on the right. |
| 07 | **Completing** (transcript done) | `06-processing-3.png` | Capsule collapses to a tiny rounded **outline** (~36×11px, no fill). |
| 08 | After cancel | `16-after-cancel2.png` | Pill disappears entirely; no audio submitted; Focus unchanged. |

## Measured geometry (native pixels, 100% DPI)

All y coordinates absolute on the 1080px-tall screen. Work area bottom = 1040.

### Push-to-talk pill (silence)

| Property | Value |
|---|---|
| Capsule outer height | **30 px** (y 994–1023; 1-px anti-aliased border ramp at y 994 & 1023 with rgb ≈ 48,48,47) |
| Capsule max outer width | **≈ 73 px** (row y=1008: fill x 927–999) |
| Border | 1 px stroke, rgb ≈ 48,48,47 (subtle, lighter than fill) |
| Radius | 15 px (half height; fully rounded ends) |
| Fill | rgb 0,0,0 (pure black), no gradient observed |
| Horizontal position | Centred on screen (center ≈ 963 ≈ 960) |
| Bottom gap | 17 px above work-area bottom (1040 − 1023) |
| Silence indicator | ~11 dots, ≈ 2–3 px squares with ≈ 2 px gaps, white/off-white, vertically centred |
| Shadow | None observed outside the 1-px border |

### Hands-free pill (silence)

| Property | Value |
|---|---|
| Capsule outer height | **30 px** (y 994–1023) |
| Capsule outer width | **100 px** (measured fill rows y=995–1013: x 910–1010) |
| Border / radius / fill | Same as PTT (`#000` fill, 1-px ≈ 48,48,47 stroke, radius 15) |
| Cross button | Circle Ø ≈ 18–19 px, fill rgb ≈ 87,84,78 (warm grey), white X glyph, centred x ≈ 925 |
| Tick button | Circle Ø ≈ 18–19 px, fill white (255,255,255), black ✓ glyph, centred x ≈ 996 |
| Dots | Same silence dots, between the buttons |
| Tooltips | Cross → "Cancel"; tick → "Finish and paste"; body → "Press Mouse 4 to finish and paste" |

### Processing (transcribing) pill

| Property | Value |
|---|---|
| Capsule | ~100 × 30 px (same as hands-free shell) |
| Content | Dots on left; spinner on right |
| Spinner | 8-spoke asterisk, light periwinkle/lavender-white, Ø ≈ 13 px |
| Duration observed | < 2 s for an empty/silent utterance |

### Completing pill

| Property | Value |
|---|---|
| Capsule | Rounded outline ≈ **36 × 11 px**, 1–2 px light stroke, transparent fill, no buttons |

## Behaviour

### Input (as configured on this machine: dictation = Mouse Button 4 / XBUTTON1)

1. **Push-to-talk:** press-and-hold → pill slides/fades in (PTT, silence state, dots); speak → **bars** animate (not observed — see below); release → pill expands to ~100 px, spinner appears; on completion pill collapses to the outline form then vanishes; text is pasted into the focused window.
2. **Hands-free:** rapid double-press (two presses with a release between them, < ~400 ms apart) → pill enters hands-free mode: recording continues after release; X cancels and discards; tick finishes, transcribes and pastes ("Finish and paste"). Re-pressing the hotkey in hands-free finishes and pastes (tooltip: "Press Mouse 4 to finish and paste").
3. **Auto-repeat:** not explicitly measured for the reference app; the reference's own chord handling distinguishes physical double-presses (release between presses) from repeats. Soravo must do likewise (see state machine doc).
4. **Toggle mode:** single press toggles recording when the Flow setting is not hold-to-talk. (Soravo exposes its own hold-to-talk setting; not part of parity scope beyond the two interaction modes mandated.)
5. **Rapid interactions:** the pill does not spawn a second session on repeated presses — one session per dictation; releases during hands-free do not stop recording.
6. **Placement:** the pill sits bottom-center by default. **The placement/reposition UI could not be observed**: the reference hub window sits behind the OpenCode window on this desktop and `SetForegroundWindow` was denied by foreground-lock; the task forbids moving/minimising the user's windows without approval. Dragging the pill body did not move it. Placement interaction is therefore **unmeasured**; Soravo's placement behaviour is specified in the assignment text itself (zones, hover feedback, drag, snap, persistence).
7. **Moving the overlay / screen-edge behaviour / multi-monitor:** unmeasured (single monitor available; placement UI not reachable).
8. **Different scaling (125%/150%):** unmeasured (100% only).
9. **Error state:** unmeasured. No error was triggered (mic-unavailable path would surface one; not exercised — would affect the user's device).
10. **First-ever dictation tooltip:** a one-shot "Using Auto-detect" bubble was observed above the pill on the first hold (microphone device hint). Soravo does not need to replicate this.

## Visual design specification (derived)

- **Window:** transparent, always-on-top, non-activating (focusable false), skip-taskbar, frameless, shadowless native window; content sized to the capsule; no rectangular background anywhere.
- **Capsule:** pure `#000` fill; 1-px stroke `rgba(255,255,255,≈0.1)`; fully rounded (radius = height/2); height 30 CSS px at 100% DPI (Soravo renders at 100% scale too); PTT width ≈ 73 px, hands-free and transcribing ≈ 100 px; transition on width/opacity.
- **Silence indicator / bars:** light off-white (≈ #F5F5F5); silence = short 2–3 px dots; speech = vertical rounded bars spanning ≈ 4–20 px heights, evenly spaced, vertically centred.
- **Buttons (hands-free):** cross = Ø 18–19 px warm-grey circle (`≈ rgb(87,84,78)`), white X (hover: lighter circle + tooltip "Cancel"); tick = white circle (hover: tooltip "Finish and paste"), black ✓.
- **Spinners/dots:** spinner ≈ 8-spoke, lavender-white.
- **Tooltip:** dark bubble above the pill, single line, ~12 px white text. Never permanently visible.
- **No** text, no branding, no close button outside these states.

## Open uncertainties

1. **Speech waveform dynamics** (bar count, heights, smoothing, attack/decay) — mic captured no tone during testing; VAD never left silence. Soravo's waveform will be implemented from real AnalyserNode data with sensible smoothing; exact reference curve unknown.
2. **Placement mode** — unknown: entry gesture, zone layout, snap animation, persistence semantics. Soravo implements the assignment's stated requirements instead.
3. **Hover feedback on bars** — not applicable/not observed.
4. **Error state visuals** — unknown.
5. **Precise transition timings/easings** — unknown; values here: pill appears/disappears within ~150–250 ms (estimated from capture frames; not precisely clocked).
6. **Border pixel value** — rgb 48,48,47 ± compression; treat as ≈ 18% white.
7. **Multi-monitor & DPI** — unmeasured.
8. **Whether the reference uses separate native windows per state** — unmeasured; Soravo uses one window with CSS state changes.

## Testable acceptance criteria (for the rebuilt overlay)

1. Capsule renders 30 px tall, fully rounded, pure black, 1-px subtle border; PTT width ≈ 73 px; hands-free ≈ 100 px; measured from screenshot at 100% DPI within ±2 px.
2. Bottom-centre placement at default anchor; 17 px above work-area bottom (±2 px at 100% DPI).
3. Hold-to-talk: pill appears on press, bars react to mic, disappears ≤ 3 s after release.
4. Double-press (release between presses, < 400 ms) enters hands-free; pill persists after release; X discards; ✓ transcribes and pastes exactly once.
5. Single press never enters hands-free; single hold never toggles hands-free.
6. Auto-repeat (synthetic press without release) never converts to hands-free.
7. No buttons in PTT; cross/tick only in hands-free.
8. Tooltips on hover only; nothing permanently overlaid.
9. Processing state shows spinner; completion collapses pill; error shows persistent error affordance (deviation from reference allowed — see states doc).
10. Placement mode: zones visible, hover feedback, drag-and-drop, snap, persistence across restart; pill never placed outside work area or under the taskbar.
