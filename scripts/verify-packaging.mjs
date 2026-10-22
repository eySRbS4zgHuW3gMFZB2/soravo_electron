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

import { readFileSync, existsSync, readdirSync } from "node:fs";
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

const resources = bundle.resources ?? {};
const EXPECTED_SOURCE_FRAGMENT = "crispasr-windows-x86_64-cpu";
const EXPECTED_TARGET = "crispasr";
if (typeof resources !== "object" || Array.isArray(resources) || Object.keys(resources).length === 0) {
  fail("bundle.resources must be a non-empty object (map form)");
} else {
  const engineEntry = Object.entries(resources).find(
    ([k, v]) => k.includes("crispasr") && typeof v === "string" && v.includes("crispasr")
  );
  if (!engineEntry) {
    fail("bundle.resources must contain an entry mapping a CrispASR source to a 'crispasr' target");
  } else {
    const [src, tgt] = engineEntry;
    if (!src.includes(EXPECTED_SOURCE_FRAGMENT)) {
      fail("bundle.resources source should reference the tracked engine directory (expected path containing 'crispasr-windows-x86_64-cpu')");
    }
    if (tgt !== EXPECTED_TARGET) {
      fail(`bundle.resources target must be exactly '${EXPECTED_TARGET}', got '${tgt}'`);
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
const engineDir = join(root, "third-party", "crispasr", "extracted", "crispasr-windows-x86_64-cpu");
const requiredEngineFiles = ["crispasr.exe", "openblas.dll", "LICENSE", "THIRD_PARTY_NOTICES.txt", "vcruntime140.dll", "vcruntime140_1.dll", "vcomp140.dll", "msvcp140.dll", "msvcp140_1.dll", "msvcp140_2.dll", "concrt140.dll", "vccorlib140.dll"];
const vcRuntimeAtRoot = ["vcruntime140.dll", "msvcp140.dll", "msvcp140_1.dll", "msvcp140_2.dll", "concrt140.dll", "vccorlib140.dll"];

for (const f of requiredEngineFiles) {
  if (!existsSync(join(engineDir, f))) fail(`Missing tracked engine file: ${f}`);
}

// --- 3. Runtime lookup check ---
const libPath = join(root, "src-tauri", "src", "lib.rs");
const libContent = readFileSync(libPath, "utf8");
if (!libContent.includes('root.join("crispasr")')) {
  fail("find_crispasr_binary must check resource_dir/crispasr/ (bundled layout)");
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
      const crispasrDir = join(bundlePath, "crispasr");
      if (!existsSync(crispasrDir)) {
        fail(`crispasr/ directory missing from bundle at ${bundlePath}`);
      } else {
        for (const f of requiredEngineFiles) {
          if (!existsSync(join(crispasrDir, f))) fail(`Missing from bundle: crispasr/${f}`);
        }
      }
      for (const f of vcRuntimeAtRoot) {
        if (!existsSync(join(bundlePath, f))) fail(`Missing from bundle root: ${f} (bundleVCRuntime)`);
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