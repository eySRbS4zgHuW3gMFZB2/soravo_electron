# Soravo

Local-first voice dictation desktop app. Rebrand of Wispr Flow. All transcription runs on-device via whisper.cpp — no accounts, no cloud, no telemetry.

## Features

- **Push-to-talk dictation** — global hotkey, mic capture, local Whisper transcription, text injection into any app
- **Pill overlay** — compact floating pill with recording/transcribing/error states, animated bars, cancel/finish buttons
- **Hub window** — Dictation, History, Settings, and Insights tabs
- **Settings** — hotkey capture (press-to-capture), mic selection, model/language, smart cleanup, custom vocabulary, sounds, theme, retention, launch at login
- **Insights** — total words, WPM gauge, activity heatmap (26-week), rhythm chart, top words, repeated phrases, correction counts
- **Local-only** — SQLite history, electron-store settings, no cloud dependencies

## Prerequisites

- **Node.js** 20+ (LTS)
- **npm** 10+
- **Git**
- **Windows 10/11 x64**
- **Visual C++ Redistributable** (x64) — for Electron native modules

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
npm run dev
```

Starts electron-vite dev server with hot reload. Pill overlay + hub window open automatically.

## Build Production

```bash
npm run build
npm run dist
```

Outputs: `out/` (app) + `dist/` (installer via electron-builder).

## Key Files

| File | Purpose |
|------|---------|
| `src/main/index.ts` | Electron main process (window, IPC, hotkey, SQLite, whisper, inject) |
| `src/preload/index.ts` | IPC bridge (`window.soravo` API) |
| `src/renderer/src/App.tsx` | Pill overlay component |
| `src/renderer/src/HubApp.tsx` | Hub window (Dictation, History, Settings, Insights) |
| `src/main/history.ts` | SQLite CRUD + insights computation |
| `src/main/whisper.ts` | whisper.cpp transcription |
| `src/main/cleanup.ts` | Filler removal, capitalization, vocabulary |
| `src/main/settings.ts` | electron-store settings |
| `src/main/inject.ts` | Clipboard + SendKeys text injection |
| `progress.md` | Full development history |

## Notes

- **No admin required** for dev (portable tools used)
- **Microphone permission** needed on first run (Windows will prompt)
- **Whisper binary** is git-ignored; run `fetch:whisper` after clone
- **SQLite DB** auto-created at `%APPDATA%/soravo/soravo.sqlite`
- **Settings** stored at `%APPDATA%/soravo/soravo-settings.json`
- **Default hotkey**: `Ctrl+Alt+Space` (configurable in Settings)

## License

MIT
