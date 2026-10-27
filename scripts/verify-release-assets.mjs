/**
 * Release asset verification for Soravo.
 *
 * Validates a directory of release artifacts before upload:
 *   - at least one installer (.msi or .exe)
 *   - every installer is non-empty
 *   - Windows-only by default; pass --allow-linux to permit AppImage
 *   - SHA256SUMS exists and covers exactly the published installers
 *   - checksum entries use bare filenames without path prefixes
 *   - every listed hash matches the file on disk
 *
 * Usage:
 *   node scripts/verify-release-assets.mjs --dir <artifact_dir>
 *   node scripts/verify-release-assets.mjs --dir <artifact_dir> --allow-linux
 *
 * Exit code 0 = all checks pass, 1 = one or more checks failed.
 */

import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, resolve, basename } from "node:path";

const errors = [];
const fail = (msg) => errors.push(msg);

function argValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx < 0) return null;
  return process.argv[idx + 1] ?? null;
}

const dirArg = argValue("--dir");
if (!dirArg) {
  console.error("Usage: node scripts/verify-release-assets.mjs --dir <artifact_dir>");
  process.exit(1);
}
const artifactDir = resolve(dirArg);
if (!existsSync(artifactDir)) {
  console.error(`Artifact directory does not exist: ${artifactDir}`);
  process.exit(1);
}

const allowLinux = process.argv.includes("--allow-linux");

const files = readdirSync(artifactDir).filter((f) => !f.startsWith("."));
const installers = files.filter((f) =>
  allowLinux ? /\.(msi|exe|AppImage)$/i.test(f) : /\.(msi|exe)$/i.test(f)
);

if (installers.length === 0) {
  fail("No installer artifacts found (expected .msi or .exe" + (allowLinux ? " or .AppImage" : "") + ")");
}

for (const f of installers) {
  const st = statSync(join(artifactDir, f));
  if (st.size <= 0) fail(`Installer is empty: ${f}`);
  if (st.size < 1024 * 1024) fail(`Installer suspiciously small (<1MB): ${f}`);
}

const sumsPath = join(artifactDir, "SHA256SUMS");
if (!existsSync(sumsPath)) {
  fail("SHA256SUMS is missing");
}

let listed = [];
if (existsSync(sumsPath)) {
  const text = readFileSync(sumsPath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 2) {
      fail(`Malformed SHA256SUMS line (not two fields): ${line}`);
      continue;
    }
    const hash = parts[0];
    const name = parts.slice(1).join(" ").trim().replace(/^\*/, "");
    if (!/^[0-9a-fA-F]{64}$/.test(hash)) {
      fail(`Invalid SHA-256 hash on line: ${line}`);
    }
    if (name !== basename(name) || name.includes("/") || name.includes("\\")) {
      fail(`SHA256SUMS entry must use a bare filename without path prefix: ${name}`);
    }
    listed.push({ hash, name, line });
  }
}

const installerSet = new Set(installers);
const listedSet = new Set(listed.map((x) => x.name));

for (const f of installers) {
  if (!listedSet.has(f)) fail(`Missing checksum entry for published installer: ${f}`);
}
for (const entry of listed) {
  if (!installerSet.has(entry.name)) {
    fail(`SHA256SUMS references an installer that is not published: ${entry.name}`);
  }
}

// Duplicate checks
const seen = new Set();
for (const entry of listed) {
  if (seen.has(entry.name)) fail(`Duplicate SHA256SUMS entry: ${entry.name}`);
  seen.add(entry.name);
}

for (const entry of listed) {
  const filePath = join(artifactDir, entry.name);
  if (!existsSync(filePath)) continue;
  const data = readFileSync(filePath);
  // compute sha256
  const { createHash } = await import("node:crypto");
  const actual = createHash("sha256").update(data).digest("hex");
  if (actual.toLowerCase() !== entry.hash.toLowerCase()) {
    fail(`Checksum mismatch for ${entry.name}: expected ${entry.hash}, got ${actual}`);
  }
}

if (errors.length > 0) {
  console.error("Release asset verification FAILED:\n");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
} else {
  console.log(`Release asset verification passed: ${installers.length} installer(s) verified.`);
}
