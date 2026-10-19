# Soravo

Local-first voice dictation desktop app. Rebrand of Wispr Flow. All transcription runs on-device via whisper.cpp — no accounts, no cloud, no telemetry.

## Features

- **Push-to-talk dictation** — global hotkey, mic capture, local Whisper transcription, text injection into any app
- **Pill overlay** — compact floating pill with recording/transcribing/error states, animated bars, cancel/finish buttons
- **Hub window** — Dictation, History, Scratchpad, Settings, and Insights tabs
- **Settings** — hotkey capture (press-to-capture), mic selection, model/language, smart cleanup, custom vocabulary, sounds, theme, retention, launch at login
- **Models** — download, manage, and switch between 28 MIT-licensed ASR models (Whisper, Moonshine, and more)
- **Insights** — total words, WPM gauge, activity heatmap (26-week), rhythm chart, top words, repeated phrases, correction counts
- **Scratchpad** — quick notes with pin, delete, copy, auto-save; dictation inserts text directly into notes
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

## Transcription Engine

This app uses **CrispASR** (v0.8.43) as its transcription engine. CrispASR is a multi-backend ASR tool that supports Whisper, Parakeet, and other models.

The CrispASR binary (`crispasr.exe` + `openblas.dll`) is included in `third-party/bin/`.
The model file (`ggml-base.en.bin`, ~142 MB) is in `third-party/models/`.

To download additional models, place them in `third-party/models/` and update the model path in Settings.

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
| `src/renderer/src/HubApp.tsx` | Hub window (Dictation, History, Scratchpad, Settings, Insights) |
| `src/renderer/src/ScratchpadPage.tsx` | Scratchpad tab (quick notes with pin/delete/copy) |
| `src/renderer/src/soravo.ts` | Tauri API shim (window.soravo compatible) |
| `src/main/history.ts` | (Legacy Electron) SQLite CRUD + insights |
| `progress.md` | Full development history |

## Notes

- **No admin required** for dev (portable tools used)
- **Microphone permission** needed on first run (Windows will prompt)
- **CrispASR binary** is included in `third-party/bin/` (crispasr.exe + openblas.dll)
- **SQLite DB** auto-created at `%APPDATA%/soravo/soravo.sqlite`
- **Settings** stored at `%APPDATA%/soravo/soravo-settings.json`
- **Default hotkey**: `Ctrl+Alt+Space` (configurable in Settings)

## Tech Stack

- **Framework**: Tauri v2 (Rust backend + WebView frontend)
- **Frontend**: React 18, TypeScript, Vite
- **Storage**: SQLite (rusqlite) + tauri-plugin-store
- **Models**: 28 MIT-licensed ASR models, downloaded on-demand to %APPDATA%/soravo/models/
- **Transcription**: CrispASR (ggml-base.en.bin, ~142 MB, multi-backend ASR)
- **Packaging**: Tauri bundle (NSIS + MSI)

## License

MIT
