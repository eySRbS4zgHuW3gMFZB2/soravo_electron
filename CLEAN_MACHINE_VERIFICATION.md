# Clean-Machine Verification Procedure (P0-01)

**Status:** UNVERIFIED — no clean Windows machine was available for testing during P0-01.
**Task:** P0-01 (Windows CrispASR packaging and clean-machine launch)
**Date:** 2026-10-22

---

## What was verified (developer machine)

1. ✅ `cargo build` succeeds with Rust 1.90.0 MSVC toolchain (37 tests pass).
2. ✅ `npm run tauri:build` produces MSI (15.39 MiB) and NSIS (10.56 MiB) installers.
3. ✅ MSI installer contains all required files:
   - `crispasr/crispasr.exe` (SHA-256: C9E6C7E51276165E2A63CE383F35652139466A359671E0AF8B037F15CFB66D8A)
   - `crispasr/openblas.dll` (SHA-256: 4E984D635FAD4466DC67C3CB0E311F9C53CED93BD26CE97AEF02DA37054F33A4)
   - `crispasr/crispasr-quantize.exe`
   - `crispasr/LICENSE` (MIT, 2023-2026 The ggml authors)
   - `crispasr/THIRD_PARTY_NOTICES.txt`
   - `crispasr/vcruntime140_1.dll` (VC++ runtime, 14.51.36247.0)
   - `crispasr/vcomp140.dll` (VC++ OpenMP runtime, 14.51.36247.0)
   - `vcruntime140.dll`, `msvcp140.dll`, `msvcp140_1.dll`, `msvcp140_2.dll`, `concrt140.dll`, `vccorlib140.dll` (from bundleVCRuntime)
4. ✅ Engine starts from extracted MSI: `crispasr.exe --version` reports version 0.8.43, built with MSVC 1951, Windows x86_64.
5. ✅ `find_crispasr_binary()` updated to check `resource_dir/crispasr/` first (bundled layout).
6. ✅ `npm run typecheck` passes.
7. ✅ `cargo test` passes (37 tests, 0 failures).
8. ✅ Packaging verification script passes (config + bundle contents).

## What is NOT verified (unverified gate)

**Clean-machine install test (P1-06):** NOT performed. No clean Windows machine (without developer tools, without VC++ Redistributable, without source tree) was available.

The developer machine has:
- Visual Studio 2017 Build Tools (with VC++ Redistributable v14.16)
- VC++ Redistributable v14.51.36247.0 (from VS 2022)
- Rust 1.90.0 MSVC toolchain
- Node.js 26.12.0, npm 11.20.0
- Git, Python, and other developer tools

These could mask missing-dependency problems.

---

## Exact manual test procedure for clean-machine verification

**Prerequisites:**
- A Windows 10 or Windows 11 machine with NO developer tools installed
- NO Visual Studio, NO Rust, NO Node.js, NO Git, NO Python
- NO VC++ Redistributable (check: `C:\Windows\System32\vcruntime140.dll` should NOT exist, or should be an older version)
- Ideally a VM or a freshly installed Windows instance

**Steps:**

1. **Transfer the installer** to the clean machine:
   - Copy `Soravo_0.1.0_x64-setup.exe` (NSIS) or `Soravo_0.1.0_x64_en-US.msi` (MSI) to the clean machine.
   - Do NOT transfer any source code, node_modules, or third-party/ directory.

2. **Install:**
   - Run the installer (NSIS: double-click; MSI: `msiexec /i Soravo_0.1.0_x64_en-US.msi`).
   - Accept the default install location (`C:\Program Files\Soravo\`).

3. **Verify engine files are present:**
   ```
   dir "C:\Program Files\Soravo\crispasr\"
   ```
   Expected: `crispasr.exe`, `openblas.dll`, `crispasr-quantize.exe`, `LICENSE`, `THIRD_PARTY_NOTICES.txt`, `vcruntime140_1.dll`, `vcomp140.dll`
   
   Also verify VC++ runtime at root:
   ```
   dir "C:\Program Files\Soravo\vcruntime140.dll"
   dir "C:\Program Files\Soravo\msvcp140.dll"
   ```

4. **Launch the app:**
   - Start Soravo from the Start menu or desktop shortcut.
   - The app should open without errors.

5. **Verify engine is found:**
   - Open the hub window → Settings or Models tab.
   - The app should NOT show "CrispASR engine is missing from this installation."
   - The runtime status should show the engine as available.

6. **Download a model:**
   - Go to the Models tab.
   - Download a model (e.g., tiny.en).
   - Wait for download to complete and verify the model shows as "Installed."

7. **Test dictation:**
   - Press and hold the dictation hotkey (default: Ctrl+1).
   - Speak a short phrase.
   - Release the hotkey.
   - Verify the transcribed text appears in the target application.

8. **Verify no developer tools were needed:**
   - Confirm no `npm run fetch:asr` was run.
   - Confirm no source tree is present.
   - Confirm no developer tools (Node, Rust, Git) are installed.

9. **Record results:**
   - Date, machine specs (Windows version, architecture)
   - Installer used (MSI or NSIS)
   - All steps passed/failed
   - Any error messages
   - Screenshots if possible

---

## Automated packaging check

Run the packaging verification script:

```bash
# Config check only (no build required)
node scripts/verify-packaging.mjs

# Config + bundle contents (requires built installer)
node scripts/verify-packaging.mjs --bundle <extracted_msi_dir>/PFiles/Soravo
```

The script checks:
1. `bundle.active` is true
2. `bundle.resources` is non-empty and includes a CrispASR path
3. `bundle.windows.bundleVCRuntime` is true
4. `bundle.externalBin` is empty (engine bundled via resources, not sidecar)
5. Tracked engine files exist (`crispasr.exe`, `openblas.dll`, `LICENSE`, `THIRD_PARTY_NOTICES.txt`)
6. VC++ runtime DLLs exist in engine dir (`vcruntime140_1.dll`, `vcomp140.dll`)
7. `find_crispasr_binary` checks `resource_dir/crispasr/` (bundled layout)
8. (With --bundle) All engine files present in extracted installer
9. (With --bundle) VC++ runtime DLLs present in bundle root

---

## CI integration (future)

The packaging check can be added to CI as a separate job on `windows-latest`:

```yaml
packaging-check:
  name: Verify CrispASR packaging
  runs-on: windows-latest
  timeout-minutes: 30
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: 20 }
    - uses: dtolnay/rust-toolchain@stable
    - run: npm ci
    - run: npm run tauri:build
    - run: node scripts/verify-packaging.mjs --bundle src-tauri/target/release/bundle/msi/extracted/PFiles/Soravo
```

Note: This requires extracting the MSI first. A simpler approach is to check the NSIS installer or use a script that inspects the bundle directory directly.

---

## Status

- **Config check:** ✅ Passes
- **Build check:** ✅ Passes (MSI + NSIS built successfully)
- **Bundle contents check:** ✅ Passes (all engine + VC++ runtime files present)
- **Engine startup (dev machine):** ✅ Passes (version 0.8.43, MSVC 1951)
- **Clean-machine test (P1-06):** ❌ NOT VERIFIED — no clean Windows machine available