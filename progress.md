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
- [x] Content panel with a 24px corner, its own scroll area, and a pinned page header
- [x] Title bar with a theme menu plus minimize/maximize/close
- [x] Dictation page: greeting with the shortcut spelled out as key chips, hero band, dated
      transcript feed with copy/delete, and a right-hand rail (word counts, voice profile, daily goal)
- [x] History page: date-grouped transcript feed with search, copy, delete, clear all
- [x] Insights page: Your usage / Your voice tabs, WPM gauge, fixes made, total words, rhythm
      chart, 26-week heat-map, top words, repeated phrases
- [x] Dictionary page: personal word list with add, edit, remove, import and export
- [x] Style page: clean-up, punctuation and language rules as cards
- [x] Models page: card grid of downloadable transcription models
- [x] Snippets page: phrase expansion with search, sort, bulk delete and import
- [x] Scratchpad page: notes list with pin/copy/delete and an inline editor
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