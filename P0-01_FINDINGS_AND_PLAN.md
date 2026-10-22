# P0-01 Findings and Minimal Implementation Plan

**Task ID:** P0-01
**Worktree:** `.worktrees/P0-01-crispasr-packaging`
**Branch:** `chore/P0-01-crispasr-packaging`
**Base:** `a6face1` (origin/main)
**Date:** 2026-10-22

---

## Skill Selection Gate

Skills loaded for this task:
1. **tauri-v2** — Tauri v2 configuration, bundling, permissions, IPC patterns.
2. **rust-best-practices** — Rust code quality, error handling, ownership patterns.

Skills considered but not loaded:
- security-review — licensing/redistribution constraints are documented in the pack's 22_REVERSE_ENGINEERING_AND_PROVENANCE.md; the LICENSE is MIT and redistribution is permitted. No code security review needed for this audit phase.
- shadcn, playwright, supabase, cloudflare — not relevant to packaging.

MCP/CLI tools used:
- `objdump` (via Git Bash) — to inspect PE dependencies of crispasr.exe and openblas.dll.
- `Get-FileHash` — to compute SHA-256 of tracked engine files.
- `gh` CLI — for PR/CI verification (prior session).

---

## Audit Findings

### Finding 1: Engine not bundled (CONFIRMED)

**Source:** `src-tauri/tauri.conf.json`, lines 40-48

```json
"bundle": {
  "active": true,
  "targets": "all",
  "icon": [...],
  "resources": [],
  "externalBin": []
}
```

`bundle.resources` and `bundle.externalBin` are both empty arrays. The Tauri bundler does not copy the CrispASR engine or any of its files into the installed application.

**Evidence:** A release build produces ~6.15 MB (MSI) / ~4.28 MB (NSIS), far smaller than the ~20 MB engine. Confirmed in 23_SOURCE_AUDIT_NOTES.md finding 3.

### Finding 2: Tracked engine location (CONFIRMED)

**Source:** `git ls-files third-party/`

The Windows engine is committed at:
```
third-party/crispasr/extracted/crispasr-windows-x86_64-cpu/
├── crispasr.exe          (19,210,240 bytes)
├── openblas.dll          (1,781,760 bytes)
├── crispasr-quantize.exe (603,136 bytes)
├── LICENSE               (1,206 bytes, MIT)
└── THIRD_PARTY_NOTICES.txt (34,411 bytes)
```

Also tracked: `third-party/crispasr/crispasr.zip` (8,700,000+ bytes) — the source archive.

`third-party/bin/` is git-ignored and contains 0 tracked files (40 files exist only on developer machines, produced by `npm run fetch:asr`).

### Finding 3: Runtime lookup fails on installed machine (CONFIRMED)

**Source:** `src-tauri/src/lib.rs`, `find_crispasr_binary()` (lines 476-496)

The function searches:
1. `<root>/third-party/bin/<exe>` — does not exist on installed machine (git-ignored, not bundled)
2. `<root>/third-party/crispasr/extracted/<build>/<exe>` — does not exist on installed machine (not bundled)

Across roots: `current_dir`, `project_root`, `resource_dir`. On an installed machine:
- `current_dir` = install directory (no `third-party/` subdirectory)
- `project_root` = parent of install directory (no `third-party/` subdirectory)
- `resource_dir` = install directory (no engine, because `bundle.resources` is empty)

**Result:** `find_crispasr_binary` returns `None` on an installed machine. The app reports "CrispASR is not installed. Run `npm run fetch:asr` to download it." — meaningless to an end customer.

### Finding 4: Runtime dependencies of crispasr.exe (NEW)

**Source:** `objdump -p crispasr.exe` (via Git Bash)

crispasr.exe depends on:
| DLL | Source | Tracked? | Clean-machine available? |
|---|---|---|---|
| openblas.dll | CrispASR (ggml) | ✅ Yes | Must bundle |
| MSVCP140.dll | VC++ Redistributable | ❌ No | ❌ No (not part of Windows) |
| VCRUNTIME140.dll | VC++ Redistributable | ❌ No | ❌ No |
| VCRUNTIME140_1.dll | VC++ Redistributable | ❌ No | ❌ No |
| VCOMP140.DLL | VC++ Redistributable (OpenMP) | ❌ No | ❌ No |
| api-ms-win-crt-*.dll | Universal C Runtime | N/A | ✅ Yes (part of Windows 10+) |
| WS2_32.dll, SHELL32.dll, KERNEL32.dll, ADVAPI32.dll | Windows system | N/A | ✅ Yes |
| MFPlat.DLL, MFReadWrite.dll | Media Foundation | N/A | ✅ Yes (Windows 10+) |
| WINHTTP.dll | Windows system | N/A | ✅ Yes |

openblas.dll also depends on VCRUNTIME140.dll and api-ms-win-crt-*.dll.

**Critical gap:** The VC++ Redistributable DLLs (MSVCP140, VCRUNTIME140, VCRUNTIME140_1, VCOMP140) are NOT part of a clean Windows install. Without them, the engine will not launch.

### Finding 5: VC++ Redistributable on developer machine (CONFIRMED)

**Source:** Registry check

The developer machine has VC++ x64 Redistributable v14.51.36247.00 installed. This masks the missing-dependency problem during development. A clean machine would fail.

### Finding 6: Licensing (CONFIRMED)

**Source:** `third-party/crispasr/extracted/crispasr-windows-x86_64-cpu/LICENSE`

- License: MIT (Copyright 2023-2026 The ggml authors)
- Redistribution: permitted without restriction
- Condition: include copyright notice in all copies
- THIRD_PARTY_NOTICES.txt documents all third-party components (ggml, llamafile/sgemm, Silero, etc.)

Redistribution rights confirmed. The LICENSE and THIRD_PARTY_NOTICES.txt must be included in the bundle.

### Finding 7: ADR-0010 is PROPOSED (CONFIRMED)

**Source:** `15_ADR_INDEX.md`

ADR-0010 (CrispASR engine packaging source) is PROPOSED, not ACCEPTED. The bundled layout is not yet decided. The three options are:
1. Tauri `bundle.resources` mapping
2. `externalBin` sidecar
3. Deliberate rename of the tracked staging directory

Must be chosen and recorded before packaging work begins (task P1-03).

### Finding 8: Linux is BLOCKED (CONFIRMED)

**Source:** Multiple pack documents, `find_crispasr_binary` in lib.rs

No Linux CrispASR executable or shared-library set is tracked. `find_crispasr_binary` resolves `crispasr` (not `crispasr.exe`) on non-Windows. A Linux build would install but fail to transcribe.

### Finding 9: Tauri configuration (CONFIRMED)

- `bundle.targets: "all"` — builds for all platforms, but only Windows has an engine.
- `app.security.csp: null` — must be addressed before commercial auth flows (not part of P0-01).
- Tauri version: 2.12.4, Rust 1.98.1, Node 26.12.0, npm 11.20.0.
- No `.cargo/config.toml`, `build.rs` is standard `tauri_build::build()`.

### Finding 10: The zip archive (CONFIRMED)

`third-party/crispasr/crispasr.zip` (8.7 MB) contains the same files as the extracted directory. It is tracked in git but is not needed for bundling — the extracted directory is the source.

---

## Research Findings (from subagent delegation)

### Tauri v2 bundle.resources (CONFIRMED via research)

`bundle.resources` can be an array of strings OR an object (map) of source → target paths. The map form is recommended for clean layout control.

Recommended configuration:
```json
"bundle": {
  "resources": {
    "../third-party/crispasr/extracted/crispasr-windows-x86_64-cpu/": "crispasr"
  }
}
```

This places the engine at `resource_dir()/crispasr/crispasr.exe` (and companion files).

In dev mode, Tauri copies resources to the target directory, so `resource_dir()` works identically in dev and production.

`externalBin` is NOT recommended for this use case because it only handles a single executable and doesn't bundle companion DLLs.

### VC++ Redistributable strategy (CONFIRMED via research)

Tauri v2 supports `bundle.windows.bundleVCRuntime: true`, which copies the VC++ CRT DLLs into the installer. This is the cleanest zero-cost approach.

The VC++ Redistributable license permits:
- Local deployment (copying DLLs alongside the exe) — allowed
- Central deployment (running vc_redist.x64.exe) — recommended by Microsoft
- No attribution/notice obligation beyond license terms
- No fee

Recommended approach:
1. Set `bundle.windows.bundleVCRuntime: true` (copies MSVCP140, VCRUNTIME140, etc.)
2. Bundle the engine via `bundle.resources` (includes openblas.dll)
3. Optionally ship `vc_redist.x64.exe` as a fallback for older OS versions
4. Optionally set `build.windows.staticVCRuntime: true` for the Rust binary itself

---

## Minimal Implementation Plan

### Phase A: ADR-0010 Decision (P1-03 prerequisite)

**Action:** Choose `bundle.resources` (map form) as the bundled layout. Record in ADR-0010 as ACCEPTED.

**Rationale:**
- Simplest Tauri-native approach
- Preserves directory structure (exe + DLLs together for Windows loader)
- Works identically in dev and production
- No binary renaming required (unlike externalBin sidecar)
- Tracked files in git ensure reproducible builds

### Phase B: Bundle Configuration (P1-03 implementation)

**Changes to `src-tauri/tauri.conf.json`:**
1. Set `bundle.resources` to map the engine directory to `crispasr/`
2. Set `bundle.windows.bundleVCRuntime` to `true`
3. Optionally set `build.windows.staticVCRuntime` to `true`

### Phase C: Runtime Lookup Update (P1-03 implementation)

**Changes to `src-tauri/src/lib.rs`:**
1. Add `resource_dir/crispasr/crispasr.exe` (and companions) to `find_crispasr_binary` search paths
2. Keep existing dev-mode fallbacks (`third-party/bin/`, `third-party/crispasr/extracted/`)
3. Update the "not installed" error message to be customer-friendly

### Phase D: Packaging Verification (P1-04)

1. Build the installer (`npm run tauri:build`)
2. Inspect installer contents (MSI/NSIS) for:
   - `crispasr/crispasr.exe`
   - `crispasr/openblas.dll`
   - `crispasr/LICENSE`
   - `crispasr/THIRD_PARTY_NOTICES.txt`
   - VC++ runtime DLLs (from bundleVCRuntime)
3. Verify installer size is ~20+ MB (engine included)

### Phase E: Automated Packaging Check (P0-02)

1. Add a CI check that builds the app and verifies the engine is in the bundle
2. The check should:
   - Build the Tauri app
   - Extract/unpack the installer
   - Verify `crispasr/crispasr.exe` exists in the bundle
   - Verify `crispasr/openblas.dll` exists in the bundle
   - Verify VC++ runtime DLLs exist in the bundle
   - Report pass/fail

### Phase F: Clean-Machine Verification Procedure (P1-06)

1. Document the procedure for testing on a clean Windows machine
2. Procedure:
   a. Install on a Windows 10/11 machine with no developer tools
   b. Launch the app
   c. Verify the engine is found (no "not installed" error)
   d. Download a model via the Models tab
   e. Dictate and verify transcription works
   f. Verify no `npm run fetch:asr` step was needed

### Phase G: Linux (BLOCKED)

Linux remains blocked until P1-05 delivers a tracked, licensed Linux engine. No Linux packaging changes in this task.

---

## What will NOT be changed

- No desktop features (UI, hotkey, transcription logic)
- No website/auth/payment work
- No repository rename
- No production changes
- No Linux packaging (BLOCKED)
- No CSP changes (separate task)
- No model bundling (models are downloaded at runtime)

---

## Risk Assessment

1. **VC++ Redistributable:** The `bundleVCRuntime` feature requires the MSVC redist component on the build machine. If not installed, the build will fail. Mitigation: document the prerequisite, provide fallback (ship vc_redist.x64.exe).
2. **Installer size:** Adding the engine (~20 MB) will increase installer size from ~6 MB to ~26 MB. This is expected and acceptable.
3. **Path length:** The installed path `C:\Program Files\Soravo\crispasr\crispasr.exe` is well under Windows MAX_PATH (260 chars).
4. **DLL loading:** openblas.dll sits beside crispasr.exe in the same directory, so Windows loader will find it. ✅
5. **Dev-mode parity:** The existing dev-mode lookup (current_dir, project_root) still works. The resource_dir lookup is additive.

---

## Next Steps

1. **Owner reviews this findings/plan.**
2. If approved, implement Phase A (ADR-0010) first, then Phase B (bundle config), then Phase C (runtime lookup).
3. Build and verify (Phase D).
4. Add CI check (Phase E).
5. Document clean-machine procedure (Phase F).
6. Run CodeRabbit review on the diff.
7. Merge when all gates pass.

No broad changes will be made until the owner approves this plan.