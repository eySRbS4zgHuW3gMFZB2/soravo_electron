# Soravo — Development Progress

## Project Overview
Soravo is a local-first voice dictation desktop app (rebrand of Wispr Flow), built on Tauri v2 + React + TypeScript. Transcription runs entirely on-device via whisper.cpp (ggml-base.en model). No accounts, no cloud, no telemetry.

## Tech Stack
- **Framework**: Tauri v2 (Rust backend + WebView frontend)
- **Frontend**: React 18.3.1, TypeScript 6, Vite 6.4.4
- **Storage**: SQLite (rusqlite) + tauri-plugin-store
- **Transcription**: CrispASR (ggml-base.en.bin, ~142 MB, multi-backend ASR)
- **Packaging**: Tauri bundle (NSIS + MSI)
- **Dev Tools**: Rust 1.99.1 (MSVC), Cargo 1.99.1, Node.js v26.12.0, npm 11.20.0

## Completed Features

### Core Dictation
- [x] Global hotkey toggle (push-to-talk via tauri-plugin-global-shortcut)
- [x] Microphone capture (getUserMedia with echo/noise suppression)
- [x] 16kHz mono WAV encoding (OfflineAudioContext resampling)
- [x] Local transcription via whisper.cpp CLI (file-mode, ~2s per utterance)
- [x] Clipboard injection (PowerShell SendKeys Ctrl+V, restores previous clipboard)
- [x] SQLite history storage (text, timestamp, duration, filler/vocab counts)
- [x] Live data push (Rust → frontend via Tauri events `soravo:transcript`, `soravo:data-changed`)

### UI — Pill Overlay
- [x] Compact dark pill (56px tall, fit-content width, Soravo lime accent)
- [x] Recording state: animated lime bars, cancel (X), finish (✓) buttons
- [x] Transcribing state: spinner
- [x] Error state: red dot + message
- [x] Idle state: "Soravo" wordmark
- [x] Audio feedback blips (WebAudio, no assets)
- [x] Auto-hide after completion (2.5s)
- [x] Debounced hotkey (800ms) to prevent key-repeat
- [x] Pill stays hidden on startup — only shows during dictation
- [x] Transparent window with rounded corners, no shadow/border

### UI — Hub Window
- [x] Navigation rail: brand block, Dictation, History, Insights, Dictionary, Snippets, Style, Models,
      Scratchpad, a "Local & private" card, Settings and Help
- [x] The rail folds to a 72px icon strip from a panel toggle in the title bar, with a floating
      page-name hint on hover, and remembers the choice
- [x] Dictation page: greeting with the shortcut spelled out as key chips, hero band, dated
      transcript feed with copy/delete, and a right-hand rail (word counts, voice profile, daily goal)
- [x] History page: date-grouped transcript feed with search, copy, delete, clear all
- [x] Insights page: Your usage / Your voice tabs, WPM gauge, fixes made, total words, rhythm
      chart, 26-week heat-map, top words, repeated phrases
- [x] Dictionary page: personal word list with add, edit, remove, import and export
- [x] Style page: clean-up, punctuation and language rules as cards
- [x] Models page: card grid of downloadable models, with the download percentage and speed
- [x] Snippets page: phrase expansion with search, sort, bulk delete and import
- [x] Scratchpad page: notes list with pin/copy/delete and an inline editor
- [x] Theme: Light, Dark or System, which follows the operating system's own setting
- [x] Transparent window with rounded corners, no shadow/border

### Settings (Wispr-style sub-modals)
- [x] General tab: Language, Microphone (dropdown), Theme (light/dark), Sound effects
- [x] General → Shortcuts sub-modal: Dictate (push-to-talk), Paste last, Copy last
- [x] General → Microphone sub-modal: device selector
- [x] General → Dictation language sub-modal
- [x] System tab: Model selection, Smart cleanup, Custom vocabulary (heard-as → write-as), Start at login, Quit
- [x] Data & Privacy tab: retention (all/30 days/session), delete all transcripts
- [x] Wispr-style hotkey capture: click field, press keys, release to commit, Esc cancels
- [x] Persisted to tauri-plugin-store (JSON)
- [x] General and System pages rebuilt to Wispr Flow's layout (serif title, card rows, 164px control column)
- [x] Settings shell rebuilt to Wispr Flow's: grouped left nav, serif title, card of rows, pinned
      footer with the version, and a Shortcuts sub-dialog that scrolls with a Reset/Done footer

### Wispr Flow Feature Parity (from config.json analysis)
- [x] Hotkey capture (press-to-capture, like Wispr)
- [x] Microphone selection with auto-detect fallback
- [x] Sound effects toggle
- [x] Smart cleanup (filler removal, spacing, capitalization)
- [x] Custom vocabulary editor
- [x] Launch at login
- [x] Light/dark theme (hub re-skins live)
- [x] History retention (30-day pruning)
- [x] Push-to-talk (toggle binding)
- [x] Paste last transcript hotkey
- [x] Copy last transcript hotkey

### Global Input Hook (native)
- [x] Low-level system-wide keyboard/mouse hook (rdev) replacing the global-shortcut plugin
- [x] Push-to-talk: hold the shortcut to record, release to transcribe
- [x] Bare-key hotkeys with no modifier (CapsLock, F-keys, letters, digits, punctuation)
- [x] Mouse button hotkeys: left/right/middle/back(X1)/forward(X2), alone or with modifiers
- [x] Mouse shortcut bindings: `Ctrl+Mouse1`, `Alt+Mouse4`, and so on
- [x] Bare bindings require an exact modifier set, so `Ctrl+CapsLock` does not fire `CapsLock`
- [x] Live reconfiguration — new shortcuts apply without a restart
- [x] Works for all three actions: dictate, paste last, copy last
- [x] Hook only observes input and never consumes it, so typing elsewhere is unaffected
- [x] Insights: total words, dictations, avg wpm, day/longest streak, corrections, heatmap, top words, repeated phrases

### Phase 8: Global Input Hooks
- Created worktree `global-hotkeys` from the CrispASR checkpoint
- Replaced `tauri-plugin-global-shortcut` with a low-level system hook (`rdev`)
  - one code path for every binding type instead of two
  - the plugin cannot see bare keys, mouse buttons, or key release
- New `src-tauri/src/hotkeys.rs`: binding parser, matcher, hook thread, 10 unit tests
  - accepts `CommandOrControl+Alt+Space`, bare `CapsLock`, `F5`, `A`, `7`, `Mouse4`, `Ctrl+Mouse1`
  - bare bindings demand an exact modifier set so a stray Ctrl cannot fire them
- Settings: added `holdToTalk` toggle in Settings → General → Shortcuts
- Rewrote `HotkeyCapture.tsx` — captures mouse buttons, allows bare keys, commits on trigger release
- Refactored dictation into `start_recording` / `stop_recording` / `toggle_recording`
- Implemented `paste_last` / `copy_last` and a real `inject_text` (were stubs)
- Rewrote the runtime fetcher as `scripts/fetch-asr.mjs` (CrispASR + pickable model, streamed)

### Bugs found and fixed while building this
- **App crashed on push-to-talk release** — the hook thread called `tokio::spawn` with no
  Tokio runtime present (`STATUS_STACK_BUFFER_OVERRUN`). Replaced abortable task handles with
  generation counters so timers work from any thread.
- **Modifier tracking was dead** — `Modifiers` was re-created inside the per-event callback, so
  held Ctrl/Alt/Shift were invisible and no combination shortcut could ever match.
- **Mouse release was ignored** — only `ButtonPress` was wired up, so releasing a mouse button
  never ended the recording.
- **Releasing Ctrl before the trigger key hung the recording** — push-to-talk now remembers which
  trigger started it and stops on that trigger's release regardless of modifier drift.
- **CapsLock never worked** — rdev omits `VK_CAPITAL` from its key table, so presses arrive as
  `Key::Unknown(0x14)` and could never equal a parsed `CapsLock`. Canonicalised both sides.
- **Toggle mode silently broke** — both modes called `start_recording`, which no-ops when already
  recording, so the second tap did nothing. Gave toggle its own handler.
- **Toggle debounce was 800ms** — long enough to swallow a deliberate second tap; now 300ms.
- **Missing runtime gave a cryptic error** — a missing binary/model fell back to a bogus path and
  reported "path not found". Now names the fix: run `npm run fetch:asr`.

### Skipped (by design or platform limits)
- [ ] Account/cloud/subscription (local-only by choice)
- [ ] Screen OCR context (needs cloud AI)
- [ ] Command mode (needs cloud AI)
- [ ] Email auto-signature (needs cloud AI)
- [ ] Per-app transcription formats (needs cloud AI)
- [ ] Focus mode (needs cloud AI)
- [ ] CapsLock as standalone hotkey (needs native hook)
- [ ] Global Esc-to-dismiss (hostile UX)
- [ ] Mouse button hotkeys (needs native hook)
- [ ] Notetaker/meeting recording (out of MVP scope)
- [ ] Mouse shortcut bindings (needs native hook)
- [ ] Push-to-talk (hold-to-talk) vs toggle (Tauri global shortcut is key-down only)

## Development History

### Phase 1: Environment Setup
- Installed Chocolatey (package manager, no admin required)
- Installed Git (portable, no admin)
- Installed GitHub CLI (gh, authenticated as eySRbS4zgHuW3gMFZB2)
- Installed Node.js v26.12.0 + pnpm 12.11.2 via Chocolatey
- Installed VSCodium, Visual C++ Redistributable
- Installed Supabase MCP and Cloudflare MCP (OAuth authenticated)
- Installed Ghidra 12.1.4 + OpenJDK 21 (bring-your-own for REA)
- Installed REA (morluto/rea) with full build (npm ci, submodules, build:cached, check:fast pass)
- Elevated OpenCode desktop session to admin for system-level tasks

### Phase 2: Soravo MVP (Electron)
- Cloned Wispr Flow v1.6.1167 from local install
- Analyzed app.asar with REA (228 files, 212 JS modules, 3511 modules, 10778 findings)
- Extracted endpoints: api.wisprflow.ai, cloud.wisprflow.ai, aria-web.wispr.ai, Supabase
- Extracted config.json with 150+ user preferences
- Built Electron app with React + Vite + TypeScript
- SQLite history, whisper.cpp transcription, clipboard injection
- Pill overlay + hub window UI

### Phase 3: Wispr Flow Feature Parity
- Analyzed Wispr's config.json to extract all settings
- Implemented Wispr-style settings modal (General/System/Data & Privacy)
- Added sub-modals for Shortcuts, Microphone, Language (with Change buttons)
- Added hotkey capture dialog (press-to-capture, release-to-commit, Esc cancels)
- Added mic selection, sounds toggle, smart cleanup, vocabulary editor
- Added theme (light/dark), retention, launch at login
- Added live data push (stats auto-update after transcription)
- Added Insights page: WPM gauge, activity heatmap, rhythm chart, top words, repeated phrases

### Phase 4: UI Polish
- Wispr-style pill overlay (compact, dark, animated bars, cancel/finish buttons)
- Wispr-style heatmap (26-week, Sun-Sat rows, month labels, nav arrows, legend)
- Merged hour/weekday charts into single customizable chart with segmented toggle
- Modal dialog with sub-modals (backdrop, close button, save button)

### Phase 5: Tauri Migration (Successful)
- Created git worktree `electron-to-tauri-migration` from Electron checkpoint
- Installed Rust 1.99.1 (MSVC toolchain via rustup)
- Initialized Tauri v2 project (src-tauri/, Cargo.toml, capabilities)
- Ported Rust backend (~950 lines):
  - RecState, TranscriptEntry, InsightsData, SoravoSettings structs
  - SQLite database (open, migrate, CRUD, insights computation)
  - Settings via tauri-plugin-store (get/set with all fields)
  - Whisper transcription (spawn_blocking, path resolution)
  - Text cleanup (filler removal, capitalization, vocabulary)
  - Text injection (clipboard + PowerShell SendKeys)
  - Global hotkey registration (tauri-plugin-global-shortcut)
  - Tray icon, window management (pill + hub)
  - All IPC commands (toggle, cancel, submit_audio, history, insights, settings, etc.)
- Created frontend shim (`src/renderer/src/soravo.ts`) mapping `window.soravo` to Tauri `invoke`/`listen`
- Updated main.tsx to route by window label (pill → App, hub → HubApp)
- Configured tauri.conf.json (pill: 210×56 transparent, hub: 1240×800 transparent, shadow: false)
- Fixed whisper path resolution for dev mode (relative to project root)
- Fixed window transparency/shadow/border issues
- Fixed hotkey → pill visibility (event listener in frontend shim)
- Pill stays hidden on startup (only shows during dictation)
- Verified: cargo build succeeds, tauri dev launches, transcription works

### Phase 6: GitHub Checkpoint
- Pushed Tauri migration to GitHub as `main` branch
- Updated README.md and progress.md for Tauri v2
- Main Electron repo preserved as safe checkpoint

### Phase 7: CrispASR Migration
- Created worktree `crispasr-migration` from Tauri migration checkpoint
- Replaced whisper.cpp transcription engine with CrispASR (v0.8.43, Windows CPU)
- Downloaded CrispASR binary (crispasr.exe, ~19MB) + openblas.dll (~1.7MB)
- Updated Rust backend: binary name, CLI flags (-nt, -np), error messages
- Reusing existing ggml-base.en.bin model (CrispASR supports Whisper models natively)
- Verified: transcription works end-to-end with CrispASR
- Pushed to GitHub as `crispasr-migration` branch

### Phase 8: Global Input Hooks
- Created worktree `global-hotkeys` from CrispASR checkpoint
- Replaced tauri-plugin-global-shortcut with native rdev input hook
- Push-to-talk (hold-to-talk) via key-down/key-up edges
- CapsLock as hotkey (rdev VK_CAPITAL canonicalization)
- Mouse button hotkeys (Mouse1-5) alone or with modifiers
- Toggle mode (press to start, press to stop) + hold mode
- 10 unit tests for binding parser
- Fixed: tokio::spawn crash on hook thread, modifier tracking, mouse release, CapsLock matching
- Pushed to GitHub as `global-hotkeys` branch, merged via PR #2

### Phase 9: Models Tab
- Created worktree `models-tab` from global-hotkeys checkpoint
- Added Models tab to sidebar with 28 MIT-licensed ASR models
- Backend: list_models, download_model, delete_model, set_active_model commands
- Models stored in %APPDATA%/soravo/models/ (no model shipped with binary)
- Download streams from HuggingFace with progress events
- Frontend: Models page with download progress bar, set active, delete
- Model catalog: Whisper family, Moonshine, GigaAM, Kyutai, GLM-ASR, Hikari, MOSS, minI-Omni2, VibeVoice, MiMo, Hojo-ASR
- fetch-asr.mjs script for downloading CrispASR + models
- Verified: download, set active, transcription all work
- Pushed to GitHub as `models-tab` branch, merged via PR #3

### Phase 10: Scratchpad Feature (PR #6)
- Rebuilt Scratchpad as embedded hub tab (not separate window) based on Wispr Flow reverse engineering
- SQLite `scratchpad_notes` table with CRUD commands
- ScratchpadPage.tsx with note creation, editing, pinning, deletion, copying, auto-save
- Hotkey integration: global hook disabled when textarea focused, local keydown/keyup handling
- Transcript leak fix: only appends transcripts from recordings initiated on scratchpad
- Double-paste fix: counter-based gating ensures each transcript appended once
- Added ScratchpadIcon to shared icons
- Added `textarea_focused` flag to AppState for global hook control
- Settings integration: scratchpad open behavior (resume/last-pinned/new-tab) - deferred
- Verified: notes create/edit/pin/delete/copy work, hotkey works on textarea, no leak, no double-paste
- Merged via PR #6

### Phase 11: Snippets Feature (PR #7)
- Added Snippets feature inspired by Wispr Flow (personal snippets only, no team sharing)
- SQLite `snippets` table: phrase, expansion, created_at, updated_at, is_auto_learned
- Rust commands: get_snippets, add_snippet, update_snippet, delete_snippet
- `apply_snippets()` in transcription pipeline: runs after vocabulary expansion
- Case-insensitive, word-boundary match, longest-phrase-first
- SnippetsPage with search, sort (newest/oldest/alphabetical), bulk select/delete
- Add/Edit dialog with phrase + expansion fields
- Delete confirmation dialog
- Empty state + no results state
- Scratchpad fix: reset recordingFromScratchpad flag on window blur (prevents transcript leak)
- Tested with LibriSpeech transcript words (rector, catechism, stephen)
- 3/3 unit tests pass
- Merged via PR #7

### Phase 12: Add Parakeet & Canary Models (PR #8)
- Added NVIDIA Parakeet TDT v2 (1.1 GB, CC-BY-4.0) and Canary 1B v2 (1.0 GB, CC-BY-4.0) to MODEL_CATALOG
- Created MODELS.md with full catalog: 30 models, sizes, licenses, download sources
- Verified CrispASR license: MIT (github.com/CrispStrobe/CrispASR/blob/main/LICENSE)
- Verified Whisper.cpp license: MIT (github.com/ggml-org/whisper.cpp/blob/master/LICENSE)
- License summary: 28 MIT + 2 CC-BY-4.0
- Merged via PR #8

### Phase 13: Settings General/System Rebuild (PR #9)
- Reverse-engineered Wispr Flow's settings page from `app.asar` -> `.webpack/renderer/hub/index.js`
  (CSS module `31211`) and recovered the exact geometry: 48px container padding, 36px gap,
  28px EB Garamond title, 20px/12px card, 164px control column, 1px dividers
- Rebuilt Settings > General to that spec: serif title, card layout, neutral Change buttons,
  transparent theme select with sun/moon icons
- Bundled EB Garamond (OFL-1.1) as woff2 in `src/renderer/public/fonts/` - the app's CSP is
  `font-src 'self' data:`, so a CDN is not an option
- Moved Sound effects from a checkbox to a Switch to match the System page
- Rebuilt Settings > System in the same style (App settings / Sound / Notifications sections)
- Bug: switch thumb sat 7px right of centre in both states - the project skips Tailwind preflight,
  so `<button>` kept Chrome's default `padding-inline: 6px`. Fixed with `p-0` on the Switch root
- Bug: `.general-controls button` also matched the Switch (it is a button), overriding its height
  and `rounded-full` radius. Fixed by excluding `[data-slot='switch']`
- Self-review caught that the System rebuild had silently dropped three features:
  Smart cleanup (still saved, no UI left), Custom vocabulary (computed but never rendered) and
  Quit Soravo (`onQuit` passed but unused). All three restored
- The System page now scrolls on its own (`.modal-scroll`) so the Close/Save footer stays pinned
- Verified: sub-dialogs open, theme select switches and persists, vocabulary add/remove persists
  across close/reopen, 30/30 cargo tests pass
- Merged via PR #9

### Phase 14: Snippets & Scratchpad rebuilt (branch `feature/snippets-scratchpad`)
- Reverse-engineered Wispr Flow 1.6.1174 from `app.asar` -> `.webpack/renderer/hub/index.js`
  (REA application graph, 228 files / 3527 modules) and recovered the CSS modules behind both
  pages: 73570 (page shell), 85087 (hero banner), 15813 (banner examples), 24323 (tabs),
  63136 (snippet list), 43395 (note list), 75559 (banner mockup)
- Captured the live Wispr Flow Snippets and Scratchpad pages for a layout reference
- Added `src/renderer/src/pages.css` plus `components/pages/` (hero band, tab strip,
  icons) as reusable hub page primitives
- **The look is Soravo's, not Wispr's.** The page STRUCTURE came from the reverse
  engineering, but every surface, radius, type size and colour comes from DESIGN.md:

  | element       | DESIGN.md token     | value                          |
  |---------------|---------------------|--------------------------------|
  | hero band     | card-feature-dark   | ink surface, brand green, 24px |
  | page title    | display-xs          | 26px / 800                     |
  | list card     | card-content        | white surface, 24px, 24px pad  |
  | empty state   | ex-empty-state-card | white surface, 24px, 48px pad  |
  | tab label     | body-sm-strong      | 14px / 600, primary indicator  |
  | badge         | badge-positive      | pale green pill                 |
  | field         | text-input          | 12px radius, 16px, 1px ink     |

  The global Button and Input primitives were brought in line with the same spec
  (24px pill buttons with 16px/600 labels and 12px/24px padding, 12px radius inputs
  with 16px type) so the new pages sit inside the app's own design language
- Snippets page: title, Import/Add new, All/Personal tabs (the "Shared with team" tab is
  deliberately left out), search/sort/refresh utilities, hero band with example chips,
  white list card with hover edit/delete actions, empty state, JSON import
- Scratchpad page: title with Beta badge, "Add to Flow Bar" toggle, its own shortcut pill,
  hero band with the little window mockup, sticky "Recents" strip, note cards, inline editor
- **Bug fixed**: `Snippet` and `ScratchpadNote` were missing `#[serde(rename_all = "camelCase")]`,
  so the front end read `createdAt`/`isAutoLearned` as undefined and every sort threw
  `Cannot read properties of undefined (reading 'localeCompare')`. Regression test added
- **Bug fixed**: the sticky "Recents" strip (z-index 500) painted over Radix dialogs (z-50)
- **Bug fixed**: the "Open Scratchpad" dialog overflowed its card, leaving the Cancel button
  outside it - the 480px min-width now lives on the dialog panel itself
- Added the `scratchpadHotkey` setting, and a **Scratchpad section in Settings > General >
  Shortcuts** with its own shortcut capture, so the shortcut can be bound in one place
- The Shortcuts sub-modal rows were rebuilt on a two column grid; the hotkey fields used to
  overflow the dialog and the "Push to talk" checkbox did not line up with the rows above it
- Verified: add/edit/delete/search/sort/bulk delete/import/banner chip/dismiss, note
  create/type/autosave/pin/copy/delete/search/refresh, Flow Bar toggle, shortcut capture,
  Settings > General > Shortcuts, in both light and dark themes
- 31/31 cargo tests pass; Dictation, History, Insights, Models and Settings are unaffected

#### Self-review fixes (before merge)
- **Bug fixed**: `loadNotes` read `activeId` from the state captured when the Scratchpad page
  mounted. The `scratchpad-changed` event fires after every add, edit and delete - including
  the autosave when the editor loses focus - so any event moved the selection back to the first
  note and replaced the draft. A draft typed into note B was silently discarded. The active id
  is now mirrored in a ref, so a change event refreshes the list without touching the
  selection or the draft.
- **Bug fixed**: the note card had no `position: relative`, so the absolutely positioned action
  cluster (pin/copy/delete) anchored to the scroll container instead of the card and every note
  stacked its actions in the same corner. The card is now the containing block.
- **Bug fixed**: the action cluster used `z-index: 600`. The card does not open a stacking
  context, so that value resolved in the root context and would have painted over the Radix
  dialogs (`z-50`). It is now `z-index: 1`.
- The selected note and the selected snippet row now use a tint of the brand green over the card
  surface. The old `canvas-soft` fill was identical to the page surface in dark mode, which made
  the selected note look like it had no card at all.
- The Input primitive used `rounded-xl`. The theme sets `--radius` to 0.75rem, so `rounded-xl`
  is 16.8px, not the 12px that DESIGN.md asks for on a text input. It is now `rounded-lg`
  (12px). Buttons keep `rounded-3xl`, which is 24px - the non-negotiable pill.
- The tab indicator no longer animates on the first paint; the transition is gated on the
  measured state.
- Renamed `components/wispr/` to `components/pages/` (`WisprBanner` -> `PageHero`,
  `WisprTabs` -> `PageTabs`). The page structure came from the reverse engineering, but these
  are Soravo components and should not be named after another product.
- Reverted the `img-src` addition to the Content-Security-Policy. It was only needed for the
  hero photos, which are gone; the app has no images left.
- Removed the dead `.page-dialog-textarea` rule and the unused `ReactNode` re-export from the
  icon module.

### Phase 15: Hub redesigned to the Wispr Flow information architecture (branch `feature/wispr-redesign`)
- Worked in a fresh worktree (`.worktrees/wispr-redesign`) off `main` at `84c3e33`
- **Every page of the shipped Wispr Flow hub was walked** and captured as a reference:
  Dictation, Notetaker, Insights, Dictionary, Snippets, Style, Transforms, Scratchpad, plus the
  Settings shell, the "Add snippet" dialog and the Shortcuts dialog. The running app was captured
  with `PrintWindow` on the Electron render widget, and the hub bundle was analysed with REA
  (`analyze_javascript_application` over `.webpack/renderer/hub/index.js` in the extracted ASAR).
- **Ghidra on the native layer** (`Wispr Flow.exe`, x86-64 PE) confirms the hub is entirely
  renderer-side. The browser process imports 58 system libraries and 1274 symbols - the stock
  Chromium/Electron surface (D3D, DirectWrite, DXGI, UIAutomation, printing, audio) - and of the
  UI-creating Win32 APIs only `TrackPopupMenu`, `SetForegroundWindow` and `DwmSetWindowAttribute`
  are present: `CreateWindowEx`, `CreatePopupMenu`, `CreateMenu`, `Shell_NotifyIcon`,
  `RegisterClass`, `MessageBox`, `SetWindowLong` and the whole Win32 menu API are absent. The only
  application strings in the binary are "Wispr AI", "Wispr Flow" and "Wispr Flow.exe" - no native
  labels, menu items or window titles. The tray icon and tray menu are therefore built from the
  JavaScript main bundle (`new Tray(...)`, `Menu.buildFromTemplate(...)`), and every hub page is
  HTML/CSS in the renderer, so a renderer-side redesign covers the whole hub.
  (The full Ghidra auto-analysis of the 235 MB binary does not finish inside the REA bridge's
  330 s budget, so the native check was run headless against the import table instead.)
- **The information architecture now mirrors Wispr Flow's**, with Soravo's own capabilities behind it:

  | Wispr Flow        | Soravo                                                        |
  |-------------------|---------------------------------------------------------------|
  | Dictation         | Dictation (hero band, dated transcript feed, right-hand rail) |
  | Notetaker         | - (no meeting recorder; not implemented)                       |
  | Insights          | Insights (Your usage / Your voice tabs)                        |
  | Dictionary        | Dictionary (new page over the existing vocabulary)             |
  | Snippets          | Snippets                                                      |
  | Style             | Style (new page over clean-up, punctuation and language)       |
  | Transforms        | - (no LLM post-processing; not implemented)                    |
  | Scratchpad        | Scratchpad                                                    |
  | Settings          | Settings                                                      |
  | -                 | History and Models (Soravo-only pages)                         |

- New shell: a navigation rail (brand block, page list with a brand-green active indicator, a
  "Local & private" card, Settings and Help) beside a rounded content panel, and a title bar
  carrying a theme menu plus the window buttons - the same shape as Wispr Flow's hub
- Every page was rebuilt on shared primitives in `src/renderer/src/pages/`; `pages.css` was folded
  into `hub.css` and the old `hub.css` layout was replaced
- **Hero bands are gradients, not photographs.** Each band picks a slot through the `media` prop on
  `PageHero` and the matching rule in `hub.css` sets `--hero-gradient`, so a real image can be
  dropped in later by replacing that one rule
- The Settings modal was rebuilt as Wispr Flow's settings shell: a grouped left nav (Settings /
  Data), a serif page title, a card of rows with right-aligned controls, and a footer with the
  version. The Shortcuts sub-dialog now scrolls its body and pins a "Reset to default" / "Done"
  footer instead of clipping its last line
- Added a Help dialog, reachable from the rail
- **Bug fixed**: the shadcn `Button` did not forward its ref, so a Radix `DropdownMenu` trigger
  built on it had no anchor element and the menu never appeared. The theme menu in the title bar
  was dead because of it. `Button` now forwards its ref.
- **Bug fixed**: `soravo.d.ts` was shadowed by `soravo.ts`, so `window.soravo` was untyped and
  every call to it was an implicit `any`. The dead declaration file was removed and the global
  augmentation moved into `soravo.ts`, which also completed the `SoravoAPI` interface with the
  snippet and scratchpad members that were implemented but not declared. `tsc -p tsconfig.web.json`
  now reports zero errors.
- Removed the "Add to Flow Bar" toggle from the Scratchpad header - it never did anything
- **UX fix**: "Clear all" on the History page wiped every transcript on a single click with no
  confirmation. It now asks first, like the snippet and note deletions do
- Removed 42 dead CSS rules (the pre-Tauri scratchpad window styles, the old settings page
  classes and the ones the rebuild replaced)
- Verified by driving the running app with real mouse clicks: every page in both themes, the
  theme menu, all three Settings tabs and the Shortcuts sub-dialog, snippet add/edit/delete/search/
  sort, dictionary add/edit/remove/export, scratchpad note create/type/pin/copy/delete, the
  insights tabs and rhythm toggle, the style switches, and the history search
- 31/31 cargo tests pass; `tsc -p tsconfig.web.json` is clean; `npm run build` succeeds

#### Round 2: polish pass
- **The two bottom Insights cards are now the same height.** The grid used
  `align-items: start`, so "When you dictate" and the streak heat-map ended at
  different heights. The grid stretches them and their bottom edges line up.
- **The webview context menu is gone.** Right-clicking used to raise Chromium's
  "Back / Forward / Refresh / Save as / Print / Inspect" menu. `contextmenu` is
  now cancelled in the capture phase, so nothing appears.
- **The browser's own shortcuts are gone**: Ctrl+F (find in page), Ctrl+H,
  Ctrl+P, Ctrl+S, Ctrl+U, Ctrl+G, Ctrl+W/T/N, Ctrl+Tab, Ctrl+1-9, F3, F10, F12,
  Ctrl+Shift+I/J/C/S/F/W and zoom. The app's own keys are untouched - the
  hotkey capture fields still receive everything, and text fields keep their
  editing shortcuts. This lives in `src/renderer/src/appShortcuts.ts`.
- **One control family.** The registry's switch was 18 x 32px and the button was
  48px, so the two read as unrelated. The in-app scale is now
  **40 (button, select, input) / 32 (small button) / 28 (extra small) / 24
  (switch)**, and the icon buttons step 28 / 32 / 36 / 40. The switch grew to
  24 x 44px with a 20px thumb.
  *Documented deviation*: DESIGN.md's button spec is 12px/24px padding (48px
  tall) for the marketing surface. Inside the app the 48px button next to a
  24px switch did not hold together, so the in-app default is 40px.
- **The tab underline no longer touches the card below it.** The page now has a
  single 18px gap between its sections instead of a margin on the header, so a
  tab strip always clears the card underneath it.
- **Every heading and label now sits on an exact DESIGN.md token.** The app had
  15px, 18px, 20px and 26px type, none of which is a token. Now:
  page title 32/600 (display-sm), card title 20/600, list key 16/600
  (body-md-strong), list value 16/400 (body-md), card body 14/400 (body-sm),
  eyebrow 12/600 (caption), display numbers 32/900 and 24/900.
- **The list cards in Snippets, Dictionary and Scratchpad use that scale.** The
  rows were 15px regular, which is not a token and read as unstyled next to
  everything else. A Snippets or Dictionary row is now the phrase at 16/600 and
  the value it expands to at 16/400, and the card carries the 24px interior
  padding of `card-content`.
- The Scratchpad note card no longer repeats its own title in the preview - the
  preview shows the lines after the first one.
- The Settings row buttons are now `button-tertiary` (canvas surface, 1px ink
  border). A secondary button was canvas-soft on the canvas-soft card and
  disappeared into it.
- Verified by driving the app with real mouse clicks: the right-click menu and
  the Ctrl+F find bar no longer appear, every page in both themes, all three
  settings tabs, the shortcuts sub-dialog, and the add/edit/delete flows for
  snippets, dictionary entries and notes.

#### Round 3: the type scale, the tooltip and the download meter
- **The serif is gone.** The hero headline and the settings titles were set in
  EB Garamond, a face Wispr Flow uses but DESIGN.md does not: the brand is
  "Soravo Sans" for display and Inter for everything else, with Inter at weight
  900 documented as the substitute for the display face. The hero headline is
  now **Inter 900** - the brand display moment - and the dialog and settings
  titles are Inter. The two EB Garamond woff2 files were removed with it.
- **Every piece of text is now on an exact DESIGN.md token.** The app had 10, 11,
  13, 15, 18, 20, 26 and 30px type, none of which is a token:

  | element | now | token |
  |---|---|---|
  | page title, settings page title | 32 / 600 | display-sm |
  | dialog title | 24 / 600 | display-xs |
  | card title | 20 / 600 | body-lg at 600 |
  | list key, row label, field | 16 / 600 | body-md-strong |
  | list value, card body | 16 / 400 | body-md |
  | card description, row hint | 14 / 400 | body-sm |
  | eyebrow, heat-map axis, meter | 12 / 400 or 600 | caption |
  | nav link | 14 / 600 | body-sm-strong (nav-link) |

  The shadcn primitives moved with it: the registry's `font-medium` (500) is
  now `font-semibold` (600) across the badge, card, dialog, dropdown, label,
  tabs and toggle, and the tooltip bubble steps up to body-sm.
- **The "Add word" button lines up with the field.** The custom-vocabulary rows
  stack their label above the input, so the control on the right sat between
  the two. Rows that carry a field now align their control with the input, and
  the button itself is a small (32px) secondary rather than a full-size one.
  "Delete all" in Data & Privacy and "Quit Soravo" in System are small too.
- **The tooltip trigger is a real icon.** The affordance was a grey circle with
  a letter "i" in it; it is now a 15px lucide Info glyph in a 20px ghost
  button that picks up the surface on hover.
- **The tooltip bubble actually appears.** The Radix tooltip never opened - the
  bubble was portalled into the body while the settings dialog held the
  body's pointer events, and the hover never reached the trigger. The bubble
  is now drawn in CSS from the trigger's own wrapper, so it works inside a
  modal, in both themes, and it is still wired up with `role="tooltip"` and
  `aria-describedby`.
- **The Models page type is smaller** - the card names step down to
  body-md-strong (16 / 600) and the metadata to body-sm, so the long model
  names stop wrapping over three lines.
- **The download meter shows the percentage and the transfer rate.** The bar is
  followed by the completed percentage and, further right, the live speed
  (measured between two progress events, e.g. "4%  2.3 MB/s").
- Verified by driving the app: a real model download showed the bar, the
  percentage and the speed; the downloaded model and the active model were
  then put back the way they were found. 31/31 cargo tests pass,
  `tsc -p tsconfig.web.json` is clean, `npm run build` succeeds, and a
  token audit of every rule in the app reports no off-scale size or weight.

#### Round 4: the collapsible rail, the system theme, the models folder
- **REA on the Wispr Flow hub bundle** recovered how its navigation rail folds away. The sidebar item
  is a `<button>` with a 20px icon and a label `<span>` that is hidden when the rail is collapsed
  (`isCollapsed && sYe.hidden`), the brand mark stays while the wordmark and the plan pill hide, and
  the collapsed rail shows the page name in a floating hint on hover (`sYe.hoverHint`). The open/closed
  state is a persisted user preference flipped by a panel toggle in the title bar
  (`onToggleSidebarVisibility` -> `renderOptions.sidebarOpen`).
- **Ghidra on the native `Wispr Flow.exe`** confirms the rail is entirely renderer-side: the binary
  defines **no string at all** that names a sidebar, rail, nav or panel, and the only UI-creating
  Win32 APIs it imports are `TrackPopupMenu` and `DwmSetWindowAttribute` (Chromium's own). No
  `CreateWindowEx`, `CreatePopupMenu`, `CreateMenu` or `Shell_NotifyIcon`. The 58 imported libraries are
  the stock Chromium/Electron set.
- **Soravo's rail now folds the same way**: a panel toggle in the title bar collapses it to a 72px
  icon strip, the wordmark, the "Local" pill and the page labels hide, and hovering an item shows its
  name in a floating hint. The state is a new `sidebarOpen` setting, so it is remembered.
- **The theme has a third option, "system".** It follows the operating system's light/dark setting
  and keeps following it while the app is open, via a `prefers-color-scheme` listener.
- **The models folder is a real setting.** The path on the Models page and in Settings is a link that
  opens the folder, Settings > System has a "Models folder" row with a folder picker and a reset to
  the default, and the Rust side reads the setting when it lists, downloads and transcribes with a
  model. A new `open_folder` command opens it in Explorer (the shell plugin's `open` is path-scoped,
  and the user can put the models anywhere on disk).
- **The Settings shell matches Wispr Flow's**: SETTINGS holds General and System, ACCOUNT holds
  Account, Plans & Billing and Data & Privacy. The old DATA header is gone. Soravo has no accounts
  and no bill, so those two pages say so plainly and Account shows the local profile instead.
- **One control family.** Every pill button is now 36px - the `sm` size is gone from the app - and
  the inputs and selects are 36px too, so a settings row is one set of controls. The Theme select was
  the odd one out: a translucent input fill on the sage card read as a muddy hole, so it now has a
  white surface of its own.
- Verified by driving the app: the rail folds and unfolds and remembers, the hover hint appears,
  "System" repaints the app when the OS preference is dark or light, the folder picker opens the
  native "Choose the models folder" dialog, the path link opens the folder in Explorer, and all five
  Settings pages render. 31/31 cargo tests pass, `tsc -p tsconfig.web.json` is clean and
  `npm run build` succeeds.

#### Round 5: one type scale, one button tier, Wispr's window and account page
- **The type scale is now a set of tokens**, so it cannot drift again:
  `--t-caption` 12, `--t-body-sm` 16, `--t-body-md` 18, `--t-body-lg` 20,
  `--t-display-xs` 24, `--t-display-sm` 32, each with its line height. The
  brand's steps are 12 / 14 / 16 / 20 / 24 / 32; the body tier was raised two
  pixels (14 -> 16, 16 -> 18) because at app density 14px read as fine print.
  The headings keep the brand's display steps. The model card name stays at 16
  because the Models grid was tuned separately, and the shadcn primitives moved
  with the scale (`text-sm` -> `text-base`, the field and select -> `text-lg`).
- **The select keeps its own fill and only its label was wrong.** The white
  surface added last round read as a hole in the sage card, and the muted
  default label was unreadable on it. The fill is the input fill it has
  everywhere else, and the label takes the theme's foreground - white in the
  dark theme, ink in the light one. The same applies to the microphone select
  in the sub-dialog.
- **Two button tiers.** The page-level actions (Add new, Import, Save, Close,
  Done) are 36px. The utility actions that sit inside a row (Change, Reset,
  Add word, Remove, Delete all, Quit, Refresh, Clear all, and the model cards'
  Download / Set Active / Delete) are 28px, so a row of small controls no
  longer outweighs the actions around it. The Change button also became an
  outline rather than a filled pill, which is what made its edge look rough.
- **The close control is a bare cross**, not a disc.
- **The theme button in the title bar is one click.** It flips between light and
  dark; the three-way choice (Light / Dark / System) stays in Settings.
- **The Models page can be searched, filtered and sorted**: a search field over
  the name, id and licence, an All / Downloaded / Not downloaded filter, and a
  sort by name, status or size.
- **The account page follows Wispr Flow's shape.** REA on the hub bundle shows
  the account page opening with the person before the details (an avatar, a
  name, then the rows), so Soravo's opens with the local profile - the monogram
  mark, "Local profile", and a line saying the device is the whole account -
  followed by a card of rows. A Ghidra pass on the native binary confirmed
  there is nothing to port: of the 1274 imports it draws no window, menu or
  dialog of its own (`CreateWindowEx`, `CreateMenu`, `CreatePopupMenu`,
  `Shell_NotifyIcon`, `DialogBox`, `MessageBox` are all absent; only
  `TrackPopupMenu` and `DwmSetWindowAttribute` are there, both Chromium
  internals), and every string in the image that says "account", "settings" or
  "update" belongs to Chromium, V8 or Node - not to Wispr. The account page,
  the settings rail and the update check are all renderer-side in Wispr, which
  is where Soravo has them.
- **A small update check sits at the foot of the settings rail**, the way
  Wispr Flow has one there. It shows the running version and opens the
  project's releases page, where the newest build is published; Soravo has no
  auto-updater, so it does not pretend to have one. Ghidra shows why the two
  differ: Wispr's check drives Electron's own `autoUpdater` (the native
  `checking-for-update` / `update-available` / `update-downloaded` events and
  `squirrel-update-win.ts`), so it can offer "update and restart"; Soravo is
  Tauri with no updater plugin, so the honest action is to send the user to
  the releases.
- **The window matches Wispr Flow exactly.** REA on the main bundle found its
  window constants: the hub is created at 1350 x 850 with a minimum of
  1140 x 750 (`setMinimumSize`), and that is what Soravo now uses - the
  default size on every cold start, and the smallest the window can be
  dragged.
- Verified by driving the app: the theme flips on one click, the selects are
  readable in both themes, the update row shows the version, the account page
  renders with its profile header, the model search and filter narrow the grid,
  and the hub window opens at 1350 x 850. 31/31 cargo tests pass,
  `tsc -p tsconfig.web.json` is clean and `npm run build` succeeds.

#### Round 7: the hotkey, the green, and the Snippets band
- **The dictation hotkey was dead, and it took two faults to find it.**
  - The app's own shortcut guard blocks the browser's chords, and `Ctrl+1..9`
    is one of them - the same chord as the default dictation hotkey. The guard
    swallowed the key before anything could see it, so the hotkey could not
    work while the hub had the focus. The guard now knows the app's own
    chords and leaves them alone.
  - The hub window's webview takes a key press before the global hook can
    see it, so the hook never fires while the app is focused. The window
    therefore drives the recorder itself, and the native side is idempotent,
    so a press both paths see still starts one recording. Both paths are
    verified: the hotkey starts a recording with the hub focused and with
    another app focused.
  - The hook itself was never the problem. A hand-written Windows hook was
    tried and reverted: with a real `MSG` and a `DispatchMessage` loop the
    low-level hook procedure is never invoked at all, while rdev's listener
    receives every event. rdev stays.
- **The green that carries a label is the brand's lime with the brand's
  on-primary ink on it** - the pair wise.com ships (their CTA is lime with
  #163300 on it, their dark button is #163300 with the lime on it) and the
  pair DESIGN.md's own `button-primary` names. The two greens invert each
  other, and a label on green is never white: white on the lime is 1.5:1 and
  white on the positive green 2.9:1, which is why every version with white
  text on green read as broken. The lime also stays the accent for marks and
  meters: the progress bars, the heatmap, the switch, the focus ring.
- **The Snippets band lost its cross and its peach gradient.** The dismiss
  button is gone, and the band takes the same green gradient as the other
  heroes, which is the one the design already liked.
- Verified by driving the app: the hotkey starts a recording both ways, the
  primary buttons are the deep green with white text, the Snippets hero has
  no cross and a green band, and the settings dialog still reads correctly.
  31/31 cargo tests pass, `tsc -p tsconfig.web.json` is clean and
  `npm run build` succeeds.

#### Round 8: the brand's own green, and Wispr's shortcut section
- **The green is the brand's green, and it is the lime again.** The fill behind a
  label is `primary` (#9fe870) with `on-primary` (#0e0f0c) on it - the pair
  wise.com itself ships, and the pair DESIGN.md's own `button-primary` names.
  The two greens invert each other: the lime takes the ink, the deep green
  takes the lime, and a label on green is never white. White on the lime is
  1.5:1 and on the positive green 2.9:1, which is why every attempt to put
  white on green read as broken. The lime also stays the accent for marks and
  meters: the progress bars, the heatmap, the switch, the focus ring.
- **The shortcut section follows Wispr Flow's, to the measurements.** REA on
  the hub bundle gives the copy ("Push to talk" / "Hold to say something
  short", "Hands-free mode" / "Dictate hands-free by pressing this hotkey to
  start and stop", "Paste last transcript" / "Paste the last thing you
  dictated") and the layout: a stack of cards, each with the label on the
  left and the control on the right. Ghidra on the native binary confirms
  there is no shortcut surface there to copy - not one string in the image
  names a shortcut - so the whole section is renderer-side and a rebuild
  misses nothing.
- **The shortcut is a row of key chips** - the shadcn `Kbd` component, one
  chip per key - in a field that reads as an input: a canvas surface, a
  12px radius and a 1px hairline. The hairline is the muted border, not the
  ink: in the dark theme the ink is the text colour, and an ink border drew a
  hard white line around the field.
- **Push to talk is a toggle** - a switch, in the row's right-hand slot -
  and the row's description changes with it, so the setting says what it
  does.
- **The Clear button moved into the row**, next to the chips as a trash
  button, so it sits on the field's centre line.
- **One bug fixed that had been hiding in plain sight**: the preflight
  reset that gives a button the colour of the text around it was unlayered,
  and an unlayered rule outranks every cascade layer - so it was beating
  every colour utility in the app, and every button label took the inherited
  colour instead of the one its variant asked for. It sits in the base layer
  now.
- **The dictionary is tested on real speech.** LibriSpeech test-clean
  1089-134686-0001 says "stuff it into you"; the engine hears "stuffed into
  you", which is exactly what a dictionary entry is for. The new test runs
  the app's own path - the engine, then the vocabulary - and asserts the
  phrase is rewritten and the rest of the line is untouched. The audio is
  not in the repository, so the test skips unless `SORAVO_TEST_WAV` points
  at the 16 kHz mono WAV of the sample.
- Verified by driving the app: the shortcut section reads like Wispr's in
  both themes, the key chips and the trash button sit on the field's centre
  line, the deep green carries white text in both themes, and the dictionary
  test passes against the real engine and the real recording. 32/32 cargo
  tests pass, `tsc -p tsconfig.web.json` is clean and `npm run build`
  succeeds.

#### Round 9: what the self-review turned up
- **The window's own hotkey matching was broken for most keys.** It compared
  the binding's trigger with `KeyboardEvent.key`, but the capture stores the
  name the native side parses: a space is "Space", an arrow key is "Up" and a
  letter is "A". Only digits and the F-keys happened to line up, so a
  `Ctrl+A` or `Ctrl+Space` binding never fired while the hub had the focus.
  The key naming now lives in one module (`hotkeys.ts`) that both the capture
  and the matcher use, so a key is named the same way in both places.
- **Releasing the modifier before the trigger left the recording running.**
  The release was matched on the whole combination, so letting go of Ctrl
  first meant the trigger's release no longer matched. The release is matched
  on the trigger key alone now.
- **The Scratchpad could leave the global hook switched off.** The flag that
  tells the hook to stand down while a text field has the focus was only
  cleared on blur, so leaving the page with the field focused kept it set -
  and the hotkey stayed dead for the rest of the session. It is cleared when
  the page goes.
- **A hand-written Windows hook was tried and reverted.** With a real `MSG`
  and a `DispatchMessage` loop the low-level hook procedure is never invoked
  at all, while rdev's listener receives every event; rdev stays, and the
  new test pins the binding the capture records to the key the parser
  produces.
- Verified by driving the app: `Ctrl+1` and `Ctrl+A` both start a recording
  with the hub focused, and `Ctrl+1` starts one with another window
  focused. 33/33 cargo tests pass, `tsc -p tsconfig.web.json` is clean and
  `npm run build` succeeds.

#### Round 10: the model that could not be loaded
- **Moonshine is more than one file, and the app only had one of them.** The
  engine loads the Moonshine tokenizer from a `tokenizer.bin` sitting next
  to the model, by name. The app downloaded the weights and nothing else,
  so the engine loaded them and then failed on the missing file - which
  reads like a broken model rather than an incomplete install. The catalog
  now carries the companion files each model needs, they are downloaded
  with the model, and the app fetches a missing one by itself the first
  time the model is used, so an install made before this change starts
  working on its own. minI-Omni2 needs a codec file the same way.
- **A model that was cut short counted as installed.** The download wrote
  straight to the model's path, so an interrupted transfer left a partial
  file that the app reported as downloaded and the engine could not load.
  The download now goes to a temporary name and is renamed into place only
  once it is whole, and a model counts as installed only when its file is
  exactly the size the server said it would be. The `large-v3-turbo` on
  this machine is such a file - 87 MB of a 1.6 GB model - and it now shows
  as incomplete instead of failing at the first dictation.
- **Three catalog entries pointed at nothing that could be loaded.** The
  Parakeet and Canary entries named NVIDIA repository pages rather than
  files (one answered 401, the other a web page), and the Distil entry
  named a file whisper.cpp never published. They now point at the GGUF
  conversions the engine actually reads, and every URL in the catalog was
  fetched and loaded to confirm it.
- **The catalog's sizes and labels were round numbers that did not match
  the files.** They are now the byte counts the server reports, which is
  what makes the completeness check possible, and the labels name the
  quantisation the file really is.
- **The engine's failure was dumped raw into the Dictation page.** The
  error now names the file that could not be opened and says what to do
  about it, and the engine's own diagnostics are left in the log.
- Verified by driving the app: dictating with Moonshine Tiny fetches the
  missing tokenizer and transcribes; the Models page shows the model as
  incomplete with a Repair button that fetches only the missing file;
  Parakeet, Canary, Distil and the Q5_1 Whisper model all load and
  transcribe. 36/36 cargo tests pass, `tsc -p tsconfig.web.json` is clean
  and `npm run build` succeeds.

#### Round 11: AGENTS.md, for whoever comes next
- **The repository now has an `AGENTS.md`**, and the README points at it.
  It is not a style guide - it is the list of things that are true, are not
  obvious from the code, and are easy to break:
  - the engine is a separate program, so every assumption about a model
    file is an assumption about what that program does with it;
  - the three model rules - a companion file beside the model, a truncated
    file that looks whole, and a catalog URL that has to point at a file
    and not a repository page;
  - the two hotkey paths, and why both have to work and both have to be
    measured;
  - the key naming lives in one module, and the browser's `event.key` is
    not that naming;
  - the colour rules - a label on green is never white, the lime is for
    marks and not for fills;
  - Tailwind without preflight, so unlayered CSS outranks every utility;
  - where the app's data lives, and the branch convention.
- **The self-review turned up two things while writing it.** The
  `ModelInfo` type on the front end carried nine settings fields -
  `theme`, `vocabulary`, `launchAtLogin` and the rest - that the Rust
  struct has never sent; they were a copy-paste leftover and are gone.
  And the logic that decides whether a shared companion file survives its
  model being deleted was tangled inside the delete command, so it is now
  a named function with a test: the Moonshine tokenizer is read by both
  Moonshine models, and deleting one must not take it from the other.
- The new test caught a mistake in the test itself on the first run - the
  helper was written to answer "is it needed elsewhere", and the
  assertion had it backwards. Fixed, and 37/37 cargo tests pass with
  `tsc -p tsconfig.web.json` clean and `npm run build` succeeding.

#### Round 10: the merge, and a type check that actually runs
- **The type check was a no-op.** `npm run typecheck` and the build's first
  step both pointed at `tsconfig.json`, which is the solution config and
  checks nothing - the renderer was never type-checked, and `@types/react`
  was not even a dependency, so the check could not have run. Both now point
  at `tsconfig.web.json`, the React types are declared, and the build fails
  on a type error instead of shipping it.
- **Two stale lines in the README**: the serif family was removed when the
  heroes moved to Inter 900, and the app's data lives under the
  `com.soravo.app` identifier, not `soravo`.
- **The Wispr Flow shortcut section, measured.** REA on the hub bundle gives
  the copy and the layout, and Ghidra on the native binary confirms there is
  no shortcut surface there to copy - not one string in the image names one -
  so the whole section is renderer-side.
- **The green, the way Wise ships it.** Their primary CTA is the lime
  (#9fe870) with #163300 on it, and their dark button is #163300 with the
  lime on it: the two greens invert each other, and a label on green is
  never white. Soravo now does the same, which is also what DESIGN.md's own
  `button-primary` names.

#### Round 6: one scale, one button system, and the contrast that was failing
- **The type scale is now a true modular scale: 12 / 14 / 16 / 18 / 24 / 32.**
  It had drifted to 12 / 16 / 18 / 20 / 24 / 32, where 18 and 20 sat two
  pixels apart at the same weight and read as the same level, and where the
  28px utility buttons carried a 14px label that appeared nowhere else in the
  app. The scale is now the one the ui-ux-pro-max guidelines call for
  ("Type scale (12 14 16 18 24 32)"), and every step but 18 is a step
  DESIGN.md already names:
  - 12 fine print - eyebrows, axis labels, badges, timestamps
  - 14 small control labels - the 28px buttons, meta lines
  - 16 body copy - descriptions, nav labels, the main button, fields
  - 18 the key of a row - row labels, lead paragraphs, transcripts
  - 24 card and section titles
  - 32 page titles and display numbers
  A card title is a heading, so it takes 24; the brand's 20 - a body size -
  is not a step of the scale, and the wordmark keeps 20 as a lockup of its
  own. The settings page title moved from 32 to 24: it titles a section, not
  a page. The shadcn primitives moved with the scale: the field and the
  select carry body copy again (16), and a select's items match the dropdown
  menu's items (16) instead of being 14.
- **Buttons have one system.** A button's height follows its role: 36px for a
  call to action and for a dialog's own actions, 28px for a utility - a
  header's tools, a toolbar, a row, a card. The small buttons take a 14px
  label to match their 28px height, which is the app's meta step.
- **A destructive action that is not the point of the screen no longer shouts.**
  "Clear all" on the History page and "Delete all" in Data & Privacy were
  solid red pills that outweighed the page they sat on; they are now outlined
  red (a new `destructive-outline` variant), and the solid red is kept for
  the button inside a confirmation dialog.
- **The "Change" button's label is no longer black.** It came out black
  because the outline variant sets no colour of its own and, without
  Tailwind's preflight, a button does not inherit the colour of the text
  around it - it takes the browser's own `buttontext`. The one piece of
  preflight this app needs is now explicit (`button { color: inherit }`),
  and the outline and ghost variants name their foreground.
- **Four colour pairs failed WCAG's 4.5:1 and now pass.** The brand's mute
  (#868685) is 3.0:1 on the sage card, so the app's mute is a step darker -
  the same warm grey, far enough from the surface to read. DESIGN.md already
  answers the semantic pair: negative-darkest (#a7000d) is documented as the
  highest-emphasis destructive text and positive-deep (#054d28) is the deep
  green of the positive family, so the destructive and positive *text* takes
  those steps while the fills keep the brand's brightness. All fifteen
  audited pairs now pass 4.5:1 in both themes.
- **The tab had no focus indicator at all** - it removed the outline and
  replaced it with nothing. It and the hotkey field now take the brand's ring
  colour, the way the shadcn controls do. And the app now honours
  `prefers-reduced-motion`: the transitions and the animations stop, while
  the one spinner keeps turning, because a spinner that has stopped looks
  like a broken control.
- Verified by driving the app at both the default size (1350 x 850) and the
  minimum (1140 x 750): every page, both themes, the settings dialog and all
  five settings pages. The measured type sizes on screen are 14 / 16 / 18 /
  24 / 32 where the scale says they should be, and the "Change" label
  measures #0e0f0c - the brand's ink - in both themes. 31/31 cargo tests
  pass, `tsc -p tsconfig.web.json` is clean and `npm run build` succeeds.

#### Round 12: the Electron tree, gone
- **Soravo has been a Tauri app for a long time, but the Electron
  skeleton was still in the repository**: `src/main/` (the old main
  process - window, tray, IPC, the old whisper and history code),
  `src/preload/` (the old `contextBridge` shim), `electron.vite.config.ts`
  and `electron-builder.yml`, plus the `electron`, `electron-builder`,
  `electron-vite` and `electron-store` packages and a `tsconfig.node.json`
  that existed only to typecheck them.
- **Nothing referenced any of it.** The real build is `vite.config.ts` ->
  `src/renderer` -> `dist`, and `tauri.conf.json` points at `../dist`.
  The renderer talks to Rust through `soravo.ts` and `@tauri-apps/api`,
  not through the preload. `src/main`'s history, insights, settings,
  injection and transcription all have Rust equivalents in
  `src-tauri/src/lib.rs`. `npm ls electron` was the last check and it
  showed nothing but the runtime itself.
- **Removed**, along with the `main` field in `package.json` (it pointed
  at `./out/main/index.js`, an Electron build output), and the
  `src/main/history.ts` row in the README's key files table.
- **The `out/` entry stays in `.gitignore`, deliberately.** It is a stale
  Electron build folder, and removing the ignore rule meant `git add -A`
  swept it into the first commit of this round. The folder is gone from
  disk and the artifacts are gone from the repository, but the rule
  stays: it is cheap insurance that a leftover folder on someone's
  machine can never be committed by accident.
- **One live bug found on the way**: the "check for updates" button in
  `HubApp.tsx` opened
  `https://github.com/eySRbS4zgHuW3gMFZB2/soravo_electron/releases` -
  the Electron-era repository. It now has to point wherever the binaries
  actually live.
- Verified after the removal: `npm ls electron` is empty, `tsc -p
  tsconfig.web.json` is clean, `npm run build` succeeds, 37/37 cargo
  tests pass, and a real dictation through the running app transcribes
  with no errors in the log.

## Known Issues
1. **Bare-key hotkeys are fire-once semantics**: a bare key such as CapsLock cannot be held, so
   push-to-talk needs a modifier in practice. Bare bindings do work in toggle mode.
2. **Injection uses SendKeys**: text is pasted via clipboard + a PowerShell `SendKeys` call, so it
   lands in whichever window had focus at that moment. Games and elevated apps may ignore it.
3. **Windows only**: the input hook and the text injection path are Windows-specific.

## Environment
- **OS**: Windows 10 Enterprise LTSC 2021 (64-bit)
- **Node.js**: v26.12.0
- **npm**: 11.20.0
- **Rust**: 1.99.1 (MSVC toolchain via rustup)
- **Cargo**: 1.99.1
- **Git**: 2.56.0 (portable)
- **GitHub CLI**: 2.102.0 (authenticated as eySRbS4zgHuW3gMFZB2)
- **Package Manager**: Chocolatey 2.7.4
- **MCP Servers**: Supabase (connected), Cloudflare (connected), REA (207 tools)
- **GitHub Repo**: https://github.com/eySRbS4zgHuW3gMFZB2/soravo_electron (main = Tauri v2)

## 2026-10-24 — Auth and device review fixes

Verified and repaired four review findings: preserve the current session and finish loading after session-restore errors, show retryable sign-out failures, correct signup confirmation copy, and add device-registration error diagnostics without changing HTTP responses. The temporary behavioral harness passes 11 checks. Website typecheck, production build, and all 19 existing tests also passed. Device-handler checks used synthetic Node fixtures because Deno is unavailable.

## 2026-10-24 - P2-12 atomic webhook provisioning

Added SECURITY DEFINER RPCs finalize_webhook_payment_atomic (plus alias finalize_webhook_payment) that atomically validate provider/event/claim token/processing status, then promote/record payment, upsert entitlement, and finalize the event in one transaction. Stale token returns 0 with no business writes. Edge function now calls the RPC instead of separate writes; claim fencing and retry semantics preserved. Added pgTAP coverage and updated handler tests. Tests: website vitest 31/31 passed; typecheck and production build passed. SQL/pgTAP not executed (no local Postgres).

## 2026-10-24 — Website account/checkout workstream (worktree P3-10)

- Worktree: .worktrees/P3-10-website-account-checkout
- Branch: feature/P3-10-website-account-checkout
- Base: ea9063d (feat/P1-WEB-AUTH-CHECKOUT)
- Scope: website/src and website auth/client helpers only; no backend edits.
- Added feature/download/help and legal placeholder pages (privacy, terms, refunds, support, license).
- Added safe post-login redirect handling (sanitizeReturnTo).
- Account page: device list + revoke, entitlement status/period, monthly/lifetime behavior.
- Added Playwright smoke tests and reduced-motion/focus accessibility styles.
- Tests: npm test (46 pass), typecheck/build pass. Playwright Chromium smoke passed (13/13) on 2026-10-26.

## 2026-10-27 — Subscription ordering review fixes (P2-12 follow-up)

Verified and fixed all six supplied findings: isolate PricingPage tests, fail closed on monthly checkout guard errors, include pending/resumed in both checkout guards and the unique index, atomically order status/grant metadata writes, and cover missing period ends/stale events/late grants. Added migration 004 to upgrade an already installed index and wired its SQL tests into database CI. Website typecheck/build and 72 tests passed; disposable PostgreSQL 17.11 passed 46 assertions and 7 more after replaying the original index then upgrading. See the session handoff and external validation record for exact inputs/commands and runtime limits.
