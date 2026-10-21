# Soravo

Local-first voice dictation desktop app. Rebrand of Wispr Flow. All transcription runs on-device via whisper.cpp — no accounts, no cloud, no telemetry.

## Features

- **Push-to-talk dictation** — global hotkey, mic capture, local Whisper transcription, text injection into any app
- **Pill overlay** — compact floating pill with recording/transcribing/error states, animated bars, cancel/finish buttons
- **Hub window** — a navigation rail (brand block, page list, local-and-private card, Settings and Help) beside a rounded content panel, with Dictation, History, Insights, Dictionary, Snippets, Style, Models, Scratchpad and Settings. The rail folds away to an icon strip from the panel toggle in the title bar, the way Wispr Flow's does, and the choice is remembered. The window opens at 1350 x 850 and cannot be dragged smaller than 1140 x 750.
- **Settings** — hotkey capture (press-to-capture) for dictate, paste last, copy last and the Scratchpad; mic selection, model/language, smart cleanup, custom vocabulary, sounds, theme, retention, launch at login, and the models folder; General, System, Account, Plans & Billing and Data & Privacy, grouped the way Wispr Flow groups them
- **Theme** — Light, Dark, or System, which follows the operating system's own light/dark setting while
  the app is open. The title bar has a one-click toggle for the first two.
- **Models** — download, manage, and switch between 30 ASR models (Whisper, Moonshine, Parakeet, Canary, and more); see [MODELS.md](MODELS.md) for the full catalog and licenses. The folder they download into is a link that opens it, and it can be pointed anywhere on disk
- **Insights** — a tabbed dashboard: words-per-minute gauge, fixes made, total words, when-you-dictate rhythm chart, a 26-week activity heat-map, top words and repeated phrases
- **Dictionary** — the personal word list as a first-class page: say "sore avo" and it is written as "Soravo". Add, edit, remove, import and export the list
- **Style** — the rules Soravo applies to every dictation (clean-up, punctuation, language), as a page rather than a settings row
- **Scratchpad** — quick notes with pin, delete, copy, auto-save; dictation inserts text directly into notes. The tab is a launcher for the notes list and its own shortcut
- **Snippets** — phrase expansion shortcuts; dictate a short phrase and it expands to full text (case-insensitive, word-boundary match). Import from a JSON file
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
| `src/renderer/src/HubApp.tsx` | Hub shell (navigation rail, content panel, Settings and Help dialogs) |
| `src/renderer/src/pages/` | One file per hub page (Dictation, History, Insights, Dictionary, Snippets, Style, Models, Scratchpad) |
| `src/renderer/src/pages/shared.ts` | Shared page helpers (day grouping, word counts, hotkey chips) |
| `src/renderer/src/components/pages/` | Shared page primitives (hero band, tab strip, icons) |
| `src/renderer/src/hub.css` | The whole hub design layer: shell, page primitives and the hero gradients |
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
- **EB Garamond** (OFL-1.1) is bundled in `src/renderer/public/fonts/` for the hero headlines and the settings page titles.
  It is served locally rather than from a CDN because the app's CSP sets `font-src 'self' data:`
- **Hero bands are gradients, not photographs.** Wispr Flow ships licensed photography in its banners;
  Soravo uses a themed gradient per band so the artwork can be replaced later without touching the
  layout. Each band picks a slot through the `media` prop on `PageHero`, and the matching rule in
  `hub.css` sets `--hero-gradient` - swap that one rule for a `url(...)` to drop a real image in.
- **It behaves like an app, not a web page.** The webview's context menu is disabled, and so are the
  browser's own shortcuts (Ctrl+F find-in-page, Ctrl+P print, Ctrl+S save, F12 devtools and friends).
  The app's own shortcuts and the text fields keep working normally. See
  `src/renderer/src/appShortcuts.ts`.
- **One control family.** A button's height follows its role: 36px for a call to action and for a
  dialog's own actions, 28px for a utility - a header's tools, a toolbar, a row, a card. The small
  buttons take a 14px label to match, and the 28px tier is above the 24px WCAG pointer target.
- **One type scale, one pair of faces.** The scale is a set of tokens, so it cannot drift:
  12 / 14 / 16 / 18 / 24 / 32 - fine print, small control labels, body copy, the key of a row, card
  and section titles, page titles. The only typeface is Inter, which DESIGN.md names as the substitute
  for the display face.
- **The colour passes its contrast check.** Every text and surface pair in the app clears WCAG's
  4.5:1 in both themes, and the motion honours `prefers-reduced-motion`.
- **A green that carries a label is the brand's lime with the brand's on-primary ink on it** - the pair wise.com
  itself uses: the two greens invert each other, and a label on green is never white.
- **The shortcut section follows Wispr Flow's**: a stack of cards, the label on the left and the control on the right, with the
  shortcut shown as key chips and push-to-talk as a toggle.
- **The hotkey works wherever the app is.** A global hook catches the combination when another
  window has the focus, and the hub drives the recorder itself when it has it.
- **Model downloads report their progress.** The bar is followed by the completed percentage and
  the live transfer rate, and the models can be searched, filtered and sorted.

## Tech Stack

- **Framework**: Tauri v2 (Rust backend + WebView frontend)
- **Frontend**: React 18, TypeScript, Vite
- **Storage**: SQLite (rusqlite) + tauri-plugin-store
- **Models**: 28 MIT-licensed ASR models, downloaded on-demand to %APPDATA%/soravo/models/
- **Transcription**: CrispASR (ggml-base.en.bin, ~142 MB, multi-backend ASR)
- **Packaging**: Tauri bundle (NSIS + MSI)

## License

MIT
