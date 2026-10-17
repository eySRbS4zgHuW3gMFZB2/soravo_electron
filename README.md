# Soravo

Local-first voice dictation desktop app. Rebrand of Wispr Flow. All transcription runs on-device via whisper.cpp — no accounts, no cloud, no telemetry.

## Features

- **Push-to-talk dictation** — global hotkey, mic capture, local Whisper transcription, text injection into any app
- **Pill overlay** — compact floating pill with recording/transcribing/error states, animated bars, cancel/finish buttons
- **Hub window** — Dictation, History, Settings, and Insights tabs
- **Settings** — hotkey capture (press-to-capture), mic selection, model/language, smart cleanup, custom vocabulary, sounds, theme, retention, launch at login
- **Insights** — total words, WPM gauge, activity heatmap (26-week), rhythm chart, top words, repeated phrases, correction counts
- **Local-only** — SQLite history, tauri-plugin-store settings, no cloud dependencies

## Prerequisites

- **Node.js** 20+ (LTS)
- **npm** 10+
- **Git**
- **Rust** (MSVC toolchain) — install via [rustup](https://rustup.rs/)
- **Windows 10/11 x64**
- **Visual C++ Redistributable** (x64)

## Clone & Install

```bash
git clone https://github.com/eySRbS4zgHuW3gMFZB2/soravo_electron.git
cd soravo_electron
npm install
```

## Install whisper.cpp Runtime

```bash
npm run fetch:whisper
```

This downloads `whisper-cli.exe` + `ggml-base.en.bin` model (~150 MB) into `third-party/`.

## Run Dev Build

```bash
npm run tauri:dev
```

Starts Vite dev server + Tauri dev build. Pill overlay + hub window open automatically.

## Build Production

```bash
npm run tauri:build
```

Outputs: `src-tauri/target/release/bundle/` (NSIS installer + MSI)

## Key Files

| File | Purpose |
|------|---------|
| `src-tauri/src/lib.rs` | Rust backend (Tauri commands, SQLite, whisper, settings, hotkeys, windows) |
| `src-tauri/tauri.conf.json` | Tauri v2 config (windows, bundle, resources) |
| `src/renderer/src/main.tsx` | Frontend entry (routes pill vs hub by window label) |
| `src/renderer/src/App.tsx` | Pill overlay component |
| `src/renderer/src/HubApp.tsx` | Hub window (Dictation, History, Settings, Insights) |
| `src/renderer/src/soravo.ts` | Tauri API shim (window.soravo compatible) |
| `src/main/history.ts` | (Legacy Electron) SQLite CRUD + insights |
| `progress.md` | Full development history |

## Notes

- **No admin required** for dev (portable tools used)
- **Microphone permission** needed on first run (Windows will prompt)
- **Whisper binary** is git-ignored; run `fetch:whisper` after clone
- **SQLite DB** auto-created at `%APPDATA%/soravo/soravo.sqlite`
- **Settings** stored at `%APPDATA%/soravo/soravo-settings.json`
- **Default hotkey**: `Ctrl+Alt+Space` (configurable in Settings)

## Tech Stack

- **Framework**: Tauri v2 (Rust backend + WebView frontend)
- **Frontend**: React 18, TypeScript, Vite
- **Storage**: SQLite (rusqlite) + tauri-plugin-store
- **Transcription**: whisper.cpp (ggml-base.en.bin, ~142 MB)
- **Packaging**: Tauri bundle (NSIS + MSI)

## License

MIT
