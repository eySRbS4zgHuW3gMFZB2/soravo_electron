/**
 * Packaging verification script for Soravo.
 *
 * Checks that the Tauri bundle configuration includes the CrispASR engine
 * and its required runtime dependencies. Run after `npm run tauri:build`.
 *
 * Usage:
 *   node scripts/verify-packaging.mjs                    # config check only
 *   node scripts/verify-packaging.mjs --bundle <path>    # config + bundle contents
 *
 * Exit code 0 = all checks pass, 1 = one or more checks failed.
 */

import { readFileSync, existsSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const fail = (msg) => errors.push(msg);

// --- 1. Config check ---
const confPath = join(root, "src-tauri", "tauri.conf.json");
let conf;
try {
  conf = JSON.parse(readFileSync(confPath, "utf8"));
} catch (e) {
  fail(`Cannot parse ${confPath}: ${e.message}`);
  process.exit(1);
}

const bundle = conf?.bundle ?? {};
if (bundle.active !== true) fail("bundle.active must be true");

// bundle.resources must be a non-empty object (map form) mapping source
// directories to bundle-internal target names.
const resources = bundle.resources ?? {};
if (typeof resources !== "object" || Array.isArray(resources) || Object.keys(resources).length === 0) {
  fail("bundle.resources must be a non-empty object (map form)");
} else {
  // Windows engine entry: source dir contains "windows-x86_64-cpu", target "crispasr"
  const winEntry = Object.entries(resources).find(
    ([k, v]) => k.includes("windows-x86_64-cpu") && typeof v === "string" && v === "crispasr"
  );
  if (!winEntry) {
    fail("bundle.resources must map the Windows engine directory to target 'crispasr'");
  } else {
    const [winSrc] = winEntry;
    if (!winSrc.includes("crispasr-windows-x86_64-cpu")) {
      fail("Windows engine source should reference 'crispasr-windows-x86_64-cpu'");
    }
  }

  // Linux engine entry: source dir contains "linux-x86_64-cpu", target "crispasr-linux"
  const linEntry = Object.entries(resources).find(
    ([k, v]) => k.includes("linux-x86_64-cpu") && typeof v === "string" && v === "crispasr-linux"
  );
  if (!linEntry) {
    fail("bundle.resources must map the Linux engine directory to target 'crispasr-linux'");
  } else {
    const [linSrc] = linEntry;
    if (!linSrc.includes("crispasr-linux-x86_64-cpu")) {
      fail("Linux engine source should reference 'crispasr-linux-x86_64-cpu'");
    }
  }
}

if (bundle?.windows?.bundleVCRuntime !== true) {
  fail("bundle.windows.bundleVCRuntime must be true (VC++ runtime required for crispasr.exe)");
}

if (Array.isArray(bundle.externalBin) && bundle.externalBin.length > 0) {
  fail("bundle.externalBin should be empty (engine is bundled via resources, not sidecar)");
}

// --- 2. Tracked engine files check ---
// Windows engine files (tracked in git).
const winEngineDir = join(
  root,
  "third-party",
  "crispasr",
  "extracted",
  "crispasr-windows-x86_64-cpu"
);
const winEngineFiles = [
  "crispasr.exe",
  "openblas.dll",
  "LICENSE",
  "THIRD_PARTY_NOTICES.txt",
  "vcruntime140.dll",
  "vcruntime140_1.dll",
  "vcomp140.dll",
  "msvcp140.dll",
  "msvcp140_1.dll",
  "msvcp140_2.dll",
  "concrt140.dll",
  "vccorlib140.dll"
];
for (const f of winEngineFiles) {
  if (!existsSync(join(winEngineDir, f))) fail(`Missing tracked Windows engine file: ${f}`);
}

// Linux engine files (tracked in git).
const linEngineDir = join(
  root,
  "third-party",
  "crispasr",
  "extracted",
  "crispasr-linux-x86_64-cpu"
);
const linEngineFiles = [
  "crispasr",
  "crispasr-quantize",
  "libopenblas.so.0",
  "libgomp.so.1",
  "libgfortran.so.5",
  "libquadmath.so.0",
  "libc2pa_c.so",
  "LICENSE",
  "THIRD_PARTY_NOTICES.txt"
];
for (const f of linEngineFiles) {
  if (!existsSync(join(linEngineDir, f))) fail(`Missing tracked Linux engine file: ${f}`);
}

// Verify Linux engine executable has execute permission (only meaningful on Linux).
if (process.platform === "linux") {
  const linuxExe = join(linEngineDir, "crispasr");
  if (existsSync(linuxExe)) {
    try {
      const st = statSync(linuxExe);
      const mode = st.mode & 0o777;
      if ((mode & 0o111) === 0) {
        fail("crispasr Linux executable is not executable (missing +x permission)");
      }
    } catch (e) {
      fail(`Cannot stat crispasr Linux executable: ${e.message}`);
    }
  }
}

// --- 3. Runtime lookup check ---
const libPath = join(root, "src-tauri", "src", "lib.rs");
const libContent = readFileSync(libPath, "utf8");
if (!libContent.includes('resource_dir.join("crispasr").join(name)')) {
  fail("find_crispasr_binary must check resource_dir/crispasr/ (bundled Windows layout)");
}
if (!libContent.includes('resource_dir.join("crispasr-linux").join("crispasr")')) {
  fail("find_crispasr_binary must check resource_dir/crispasr-linux/crispasr (bundled Linux layout)");
}

// --- 4. Bundle contents check (optional, requires --bundle <path>) ---
const bundleIdx = process.argv.indexOf("--bundle");
if (bundleIdx >= 0) {
  if (!process.argv[bundleIdx + 1]) {
    fail("--bundle requires a path argument (e.g., --bundle <extracted_dir>)");
  } else {
    const bundlePath = resolve(process.argv[bundleIdx + 1]);
    if (!existsSync(bundlePath)) {
      fail(`Bundle path does not exist: ${bundlePath}`);
    } else {
      // Windows MSI layout: engine at <bundle>/crispasr/, VC++ DLLs at bundle root.
      const winCrispasrDir = join(bundlePath, "crispasr");
      const winCrispasrDirExists = existsSync(winCrispasrDir);
      if (winCrispasrDirExists && process.platform === "win32") {
        for (const f of winEngineFiles) {
          if (!existsSync(join(winCrispasrDir, f))) fail(`Missing from Windows bundle: crispasr/${f}`);
        }
        const vcRuntimeAtRoot = ["vcruntime140.dll", "msvcp140.dll", "msvcp140_1.dll", "msvcp140_2.dll", "concrt140.dll", "vccorlib140.dll"];
        for (const f of vcRuntimeAtRoot) {
          if (!existsSync(join(bundlePath, f))) fail(`Missing from Windows bundle root: ${f} (bundleVCRuntime)`);
        }
      }
      // Linux AppImage layout: engine at <bundle>/crispasr-linux/, shared libs beside it.
      const linCrispasrDir = join(bundlePath, "crispasr-linux");
      if (existsSync(linCrispasrDir)) {
        for (const f of linEngineFiles) {
          if (!existsSync(join(linCrispasrDir, f))) fail(`Missing from Linux bundle: crispasr-linux/${f}`);
        }
        // Verify Linux engine executable permission inside bundle (only on Linux).
        if (process.platform === "linux") {
          const linBundleExe = join(linCrispasrDir, "crispasr");
          if (existsSync(linBundleExe)) {
            try {
              const st = statSync(linBundleExe);
              if ((st.mode & 0o111) === 0) {
                fail("Linux crispasr executable inside bundle is not executable (missing +x)");
              }
            } catch (e) {
              fail(`Cannot stat bundled Linux crispasr: ${e.message}`);
            }
          }
        }
      }
      // Require the platform-specific engine directory in the bundle.
      if (process.platform === "linux") {
        if (!existsSync(linCrispasrDir)) {
          fail("Linux bundle missing crispasr-linux/ directory");
        }
      } else {
        if (!winCrispasrDirExists && !existsSync(linCrispasrDir)) {
          fail("No CrispASR engine directory found in bundle (expected crispasr/ or crispasr-linux/)");
        }
      }
    }
  }
}

// --- Report ---
if (errors.length > 0) {
  console.error("Packaging verification FAILED:\n");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
} else {
  console.log("Packaging verification passed.");
  if (bundleIdx >= 0 && process.argv[bundleIdx + 1]) {
    console.log("  Bundle contents verified.");
  } else {
    console.log("  Config + tracked files + source checks passed.");
    console.log("  Run with --bundle <path> to verify installer contents.");
  }
}
