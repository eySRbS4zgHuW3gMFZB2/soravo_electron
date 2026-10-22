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
if (typeof resources !== "object" || Array.isArray(resources) || Object.keys(resources).length === 0) {
  fail("bundle.resources must be a non-empty object (map form)");
} else {
  const hasEngine = Object.keys(resources).some((k) => k.includes("crispasr"));
  if (!hasEngine) fail("bundle.resources must include a CrispASR engine path");
  const target = Object.values(resources).find((v) => typeof v === "string" && v.includes("crispasr"));
  if (!target) fail("bundle.resources target must include 'crispasr'");
}

if (bundle?.windows?.bundleVCRuntime !== true) {
  fail("bundle.windows.bundleVCRuntime must be true (VC++ runtime required for crispasr.exe)");
}

if (!Array.isArray(bundle.externalBin) || bundle.externalBin.length !== 0) {
  // externalBin should be empty — we use bundle.resources, not sidecar
  if (Array.isArray(bundle.externalBin) && bundle.externalBin.length > 0) {
    fail("bundle.externalBin should be empty (engine is bundled via resources, not sidecar)");
  }
}

// --- 2. Tracked engine files check ---
const engineDir = join(root, "third-party", "crispasr", "extracted", "crispasr-windows-x86_64-cpu");
const requiredEngineFiles = ["crispasr.exe", "openblas.dll", "LICENSE", "THIRD_PARTY_NOTICES.txt"];
for (const f of requiredEngineFiles) {
  if (!existsSync(join(engineDir, f))) fail(`Missing tracked engine file: ${f}`);
}

// VC++ runtime DLLs that must be bundled alongside the engine
const requiredVcDlls = ["vcruntime140_1.dll", "vcomp140.dll"];
for (const f of requiredVcDlls) {
  if (!existsSync(join(engineDir, f))) fail(`Missing VC++ runtime DLL in engine dir: ${f}`);
}

// --- 3. Runtime lookup check ---
const libPath = join(root, "src-tauri", "src", "lib.rs");
const libContent = readFileSync(libPath, "utf8");
if (!libContent.includes('root.join("crispasr")')) {
  fail("find_crispasr_binary must check resource_dir/crispasr/ (bundled layout)");
}

// --- 4. Bundle contents check (optional, requires --bundle) ---
const bundleIdx = process.argv.indexOf("--bundle");
if (bundleIdx >= 0 && process.argv[bundleIdx + 1]) {
  const bundlePath = resolve(process.argv[bundleIdx + 1]);
  if (!existsSync(bundlePath)) {
    fail(`Bundle path does not exist: ${bundlePath}`);
  } else {
    // Check for engine files in the extracted bundle
    const crispasrDir = join(bundlePath, "crispasr");
    if (!existsSync(crispasrDir)) {
      fail(`crispasr/ directory missing from bundle at ${bundlePath}`);
    } else {
      for (const f of requiredEngineFiles) {
        if (!existsSync(join(crispasrDir, f))) fail(`Missing from bundle: crispasr/${f}`);
      }
      for (const f of requiredVcDlls) {
        if (!existsSync(join(crispasrDir, f))) fail(`Missing from bundle: crispasr/${f}`);
      }
    }
    // Check VC++ runtime at bundle root
    if (!existsSync(join(bundlePath, "vcruntime140.dll"))) {
      fail("vcruntime140.dll missing from bundle root (bundleVCRuntime)");
    }
    if (!existsSync(join(bundlePath, "msvcp140.dll"))) {
      fail("msvcp140.dll missing from bundle root (bundleVCRuntime)");
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
  if (bundleIdx >= 0) {
    console.log("  Bundle contents verified.");
  } else {
    console.log("  Config + tracked files + source checks passed.");
    console.log("  Run with --bundle <path> to verify installer contents.");
  }
}