# Soravo — Development Progress

## Project Overview
Soravo is a local-first voice dictation desktop app (rebrand of Wispr Flow), built on Electron + React + TypeScript. Transcription runs entirely on-device via whisper.cpp (ggml-base.en model). No accounts, no cloud, no telemetry.

## Tech Stack
- **Framework**: Electron 42.11.2, Electron Forge 7.11.2, electron-vite 6
- **Frontend**: React 18.3.1, TypeScript 6, Vite 6.4.4
- **Storage**: SQLite (better-sqlite3 via node:sqlite) + electron-store
- **Transcription**: whisper.cpp (ggml-base.en.bin, ~142 MB)
- **Packaging**: Electron Forge (squirrel, zip makers)

## Completed Features

### Core Dictation
- [x] Global hotkey toggle (push-to-talk via Electron globalShortcut)
- [x] Microphone capture (getUserMedia with echo/noise suppression)
- [x] 16kHz mono WAV encoding (OfflineAudioContext resampling)
- [x] Local transcription via whisper.cpp CLI (file-mode, ~2s per utterance)
- [x] Clipboard injection (PowerShell SendKeys Ctrl+V, restores previous clipboard)
- [x] SQLite history storage (text, timestamp, duration, filler/vocab counts)
- [x] Live data push (main → renderer via IPC `soravo:transcript`, `soravo:data-changed`)

### UI — Pill Overlay
- [x] Compact dark pill (56px tall, fit-content width, Soravo lime accent)
- [x] Recording state: animated lime bars, cancel (X), finish (✓) buttons
- [x] Transcribing state: spinner
- [x] Error state: red dot + message
- [x] Idle state: "Soravo" wordmark
- [x] Audio feedback blips (WebAudio, no assets)
- [x] Auto-hide after completion (2.5s)
- [x] Debounced hotkey (800ms) to prevent key-repeat

### UI — Hub Window
- [x] Sidebar: Dictation, History, Settings
- [x] Dictation page: greeting with hotkey pill, hero card, today's entries, stats (words/wpm/streak)
- [x] History page: search, copy, delete, clear all
- [x] Insights page: stats, corrections, activity heatmap (26-week, Wispr-style), WPM radial gauge, hour/weekday rhythm chart (segmented toggle), top words, repeated phrases
- [x] Title bar with minimize/maximize/close
- [x] Wispr-style dark pill overlay

### Settings (Wispr-style sub-modals)
- [x] General tab: Language, Microphone (dropdown), Theme (light/dark), Sound effects
- [x] General → Shortcuts sub-modal: Dictate (push-to-talk), Paste last, Copy last
- [x] General → Microphone sub-modal: device selector
- [x] General → Dictation language sub-modal
- [x] System tab: Model selection, Smart cleanup, Custom vocabulary (heard-as → write-as), Start at login, Quit
- [x] Data & Privacy tab: retention (all/30 days/session), delete all transcripts
- [x] Wispr-style hotkey capture: click field, press keys, release to commit, Esc cancels
- [x] Persisted to electron-store (JSON)

### Wispr Flow Feature Parity (from config.json analysis)
- [x] Hotkey capture (press-to-capture, like Wispr)
- [x] Microphone selection with auto-detect fallback
- [x] Sound effects toggle
- [x] Smart cleanup (filler removal, spacing, capitalization)
- [x] Custom vocabulary editor
- [x] Launch at login
- [x] Light/dark theme (hub re-skins live)
- [x] History retention (30-day pruning)
- [x] Push-to-talk (toggle binding, since Electron can't do key-up detection)
- [x] Paste last transcript hotkey
- [x] Copy last transcript hotkey
- [x] Insights: total words, dictations, avg wpm, day/longest streak, corrections, heatmap, top words, repeated phrases

### Skipped (by design or platform limits)
- [ ] Account/cloud/subscription (local-only by choice)
- [ ] Screen OCR context (needs cloud AI)
- [ ] Command mode (needs cloud AI)
- [ ] Email auto-signature (needs cloud AI)
- [ ] Per-app transcription formats (needs cloud AI)
- [ ] Focus mode (needs cloud AI)
- [ ] CapsLock as standalone hotkey (Electron can't bind bare CapsLock)
- [ ] Global Esc-to-dismiss (hostile UX)
- [ ] Mouse button hotkeys (needs native hook)
- [ ] Notetaker/meeting recording (out of MVP scope)
- [ ] Mouse shortcut bindings (needs native hook)
- [ ] Push-to-talk (hold-to-talk) vs toggle (Electron globalShortcut is key-down only)

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

### Phase 5: Tauri Migration Attempt
- Installed Rust 1.98.1 (GNU toolchain via Chocolatey)
- Installed MinGW-w64 (for gcc/windres)
- Installed Visual Studio 2017 Build Tools
- Created Tauri v2 project structure (src-tauri/, Cargo.toml, capabilities)
- Ported Rust backend: settings, SQLite, whisper, clipboard, tray, window management
- Migrated frontend to use @tauri-apps/api invoke/listen
- **Issue**: Rust was GNU toolchain (x86_64-pc-windows-gnu), Tauri needs MSVC
- **Issue**: Transparent window + pill stretched full width
- **Issue**: Dev build failed with linker errors
- Fixed window size (1240x800), opaque background, pill fit-content
- Fixed duplicate tauri_plugin_log registration
- Bundled whisper-cli + DLLs + model into Tauri resources
- Fixed dev build by installing Rust MSVC toolchain (rustup + stable-x86_64-pc-windows-msvc)

### Phase 6: Revert to Electron
- Reverted all Tauri changes via git reset --hard HEAD
- Restored Electron build (app.exe, MSI, NSIS installers)
- Verified Electron dev build runs correctly

## Known Issues
1. **Push-to-talk (hold)**: Electron globalShortcut only fires key-down, so true hold-to-talk isn't possible. Current binding is toggle (press to start, press to stop).
2. **CapsLock hotkey**: Electron can't bind bare CapsLock. Wispr uses native helper for this.
3. **Mouse button hotkeys**: Need native hook, not implemented in MVP.

## Environment
- **OS**: Windows 10 Enterprise LTSC 2021 (64-bit)
- **Node.js**: v26.12.0
- **npm**: 11.20.0
- **Rust**: 1.99.1 (MSVC toolchain via rustup)
- **Cargo**: 1.99.1
- **MinGW**: 16.1.0 (GCC 14.2.0)
- **Visual Studio**: 2017 Build Tools
- **Git**: 2.56.0 (portable)
- **GitHub CLI**: 2.102.0 (authenticated as eySRbS4zgHuW3gMFZB2)
- **Package Manager**: Chocolatey 2.7.4
- **MCP Servers**: Supabase (connected), Cloudflare (connected), REA (207 tools)
