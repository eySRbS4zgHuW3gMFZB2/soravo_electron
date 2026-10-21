# AGENTS.md

Working notes for anyone — human or agent — changing this repository.

Soravo is a Tauri v2 desktop app: a Rust backend (`src-tauri/`) and a React
renderer (`src/renderer/`). It records from the microphone, transcribes
locally, and injects the text into whatever app has the focus.

Read this before you touch anything. Most of what is here is not obvious
from the code, and getting it wrong breaks the app in ways that look
like something else entirely.

## The one rule

**The transcription engine is a separate program, not a library.** The app
does not parse audio. It shells out to `crispasr.exe` and reads the
transcript off stdout. Every assumption the app makes about a model file
is an assumption about what that program does with it.

## The engine

CrispASR v0.8.43, at `third-party/crispasr/extracted/`, and a copy in
`third-party/bin/` (git-ignored — the fetch script puts it there).
`find_crispasr_binary` in `src-tauri/src/lib.rs` looks in `bin/` first,
then the committed archive copy.

The engine is a multi-backend tool. It picks the backend from the model
file's contents, not from a flag, so the app never passes `--backend`.

### Three things about models that will bite you

1. **Some backends are more than one file.** The engine loads a companion
   from the model's *own folder*, by name: Moonshine reads `tokenizer.bin`,
   minI-Omni2 reads `snac-24khz.gguf`. The catalog in `lib.rs` carries
   them (`ModelCompanion`) and they are downloaded with the model. If you
   add a model with a companion and forget to list it, the engine loads
   the weights and then fails on the missing file — and the error reads
   like a broken model rather than an incomplete install.

2. **A truncated download looks like a working one.** The download writes
   to a `.part` file and renames it into place only once the byte count
   matches the server's `Content-Length`. `file_is_whole` compares the
   file's length against the catalog's `size`, which is the *exact* byte
   count the server reports — not a round number. A model whose length
   does not match is reported as incomplete, and the Models page offers a
   Repair button that fetches only what is missing.

3. **The catalog's URLs are load-bearing.** Point an entry at a
   repository page instead of a file and the app downloads a web page as
   a model. Every URL in `MODEL_CATALOG` was fetched and loaded by the
   engine before it went in. When you change one, do the same.

The upstream NVIDIA Parakeet and Canary repositories hold PyTorch
weights the engine cannot read; the catalog points at the GGUF
conversions in `cstr/*-GGUF` instead.

## Running and testing it

```bash
npm install
npm run tauri:dev      # Vite + Tauri, pill and hub both open
npm run typecheck      # tsc over the renderer
npm run build          # typecheck, then vite build
cd src-tauri && cargo test
```

`cargo test` is fast and needs nothing installed — the tests that need
the engine or a model skip themselves when it is missing.

Two of the tests want real audio. The dictionary test runs the app's own
path (engine, then vocabulary) over a LibriSpeech sample:

```bash
# The sample, as 16 kHz mono PCM:
ffmpeg -i 1089-134686-0001.flac -ar 16000 -ac 1 -c:a pcm_s16le out.wav
SORAVO_TEST_WAV=$PWD/out.wav cargo test dictionary_rewrites
```

### Driving the running app

`cargo test` will not tell you whether a dictation actually works, or
whether a change to the hub looks right. Do both by hand:

- **Screenshots.** The app is a real window; drive it with a small
  PowerShell harness that clicks, types, and captures. Re-shoot after
  any page change — the first capture after a navigation is often blank.
- **The hotkey.** Press-and-hold it and watch the pill: it must appear
  during the hold and hide after the release. Check both with the hub
  focused and with another window focused, because those are two
  different code paths (see below).

## Two hotkey paths, and why both must work

The app binds the dictation hotkey twice, on purpose:

- A **global hook** (`src-tauri/src/hotkeys.rs`, via `rdev`) sees the key
  everywhere, including when another app has the focus.
- A **window listener** in `HubApp.tsx` sees it when the hub has the
  focus, where the webview would otherwise swallow it.

Both call the same native `start_record`/`stop_record`, which are
idempotent, so a press that both see still starts one recording. If you
break one, the other may mask it in a test you are running — test both.

The hook is `rdev::listen`, which blocks on a null `MSG` pointer. A
hand-written Windows hook with a real message pump was tried and
reverted: with a real `MSG` and a `DispatchMessage` loop the low-level
hook procedure is never invoked at all, while rdev receives every event.
Do not rewrite this without measuring both paths.

## The hotkey's name, and where it lives

A binding is stored as the accelerator string the native side parses
(`CommandOrControl+Alt+Space`, `CapsLock`, `Ctrl+Mouse4`). The browser's
`KeyboardEvent.key` is a *different* naming: a space is `" "`, an arrow
key is `"ArrowUp"`, a letter is `"a"`. The app's `hotkeys.ts` is the one
place a key is named, and both the capture and the matcher go through it.
Anything that matches a key event by name is wrong unless it uses that
module.

The app also has a shortcut *guard* that swallows the browser's own
chords (Ctrl+F, Ctrl+P, F12, …) so they do not fire in the hub. The
guard knows the app's own chords and leaves them alone — otherwise
`Ctrl+1`, the default dictation hotkey, would be swallowed by the
browser's tab-switch chord.

## Design

`DESIGN.md` is the brand spec and the authority on colour, type and
spacing. Two rules have been learned the hard way and are worth stating
plainly:

- **A label on a green fill is never white.** The two greens invert each
  other: the lime `#9fe870` takes the ink `#0e0f0c` (13.05:1), and the
  deep green `#163300` takes the lime (9.45:1). White on the lime is
  1.5:1. This is the pair wise.com itself ships, and what DESIGN.md's
  `button-primary` names.
- **The lime is for marks, not fills.** Progress bars, the heat-map, the
  switch, the focus ring. A fill that carries a label is the pair above.

Type is one scale — 12 / 14 / 16 / 18 / 24 / 32 — and buttons are two
tiers: 36px for a dialog action, 28px for everything else. `hub.css` and
`styles.css` hold the tokens; `components/ui/button.tsx` holds the
variants.

## Conventions

- **Tailwind v4 without preflight.** An unlayered CSS rule outranks every
  utility class, so plain CSS in `hub.css`/`styles.css` beats
  `bg-*`. Anything meant to be overridable goes in `@layer base`.
- **shadcn/ui** components live in `src/renderer/src/components/ui/`. Use
  them rather than hand-rolling; `components.json` is the config.
- **Pages** are one file each in `src/renderer/src/pages/`, and the
  shared helpers are in `pages/shared.ts`.
- **The renderer talks to Rust through `soravo.ts`**, a typed shim over
  `invoke`. Add the command there with its type, or the front end cannot
  call it.

## Housekeeping

- The app's data lives under `%APPDATA%/com.soravo.app/` — the settings
  are `soravo-settings.json`, the database is `soravo.sqlite`, and the
  models are in `models/`. That is the identifier, not `soravo`.
- `progress.md` is the development history, written as it happened. Add
  to it when you finish a piece of work, including the wrong turns: the
  entry that says "this was tried and reverted, and here is why" has
  saved more time than one that only records the answer.
- The repo's convention is a `feature/x` branch and a separate `docs/x`
  branch, each merged to `main` as its own commit. `main` is linear.
- `MODELS.md` is the model catalog, and it is only true if every URL in
  it has been fetched and loaded.

## Things that are easy to get wrong

- **The hotkey's own chord.** Ctrl+1 is a browser tab switch. The guard
  has to know about it.
- **Releasing the modifier before the trigger.** Push-to-talk must end
  on the trigger key's release, not on the combination's.
- **A textarea that still has focus.** The global hook stands down while
  a text field has focus, so the flag has to be cleared when the page
  goes, not only on blur — otherwise dictation stays dead for the
  session.
- **A model file that is the right name but the wrong length.** Compare
  bytes, not existence.
- **A companion file.** Check the catalog has it.
