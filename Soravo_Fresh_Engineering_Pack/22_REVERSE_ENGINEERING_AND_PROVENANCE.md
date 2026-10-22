# Reverse Engineering, Provenance and Third-Party Notices

## Scope
The core app is already built. Commercial-release work must not depend on further reverse-engineering of Wispr Flow or another proprietary app. REA/Ghidra are not required for the website, accounts, payment, entitlement or dashboard tasks.

## Current product boundary
- Preserve the existing Tauri implementation.
- Preserve the current CrispASR engine.
- Do not copy proprietary source, artwork, prompts, server endpoints, private APIs, or proprietary assets from a third-party application.
- Do not describe Soravo as affiliated with another vendor.
- Keep the existing UI's independent Soravo branding and design provenance.

## Dependency provenance
For every bundled executable, DLL, model, font, icon, sound, and runtime:
- record origin URL and version;
- record SHA-256;
- record license and redistribution conditions;
- record whether it is modified;
- include required notices;
- confirm commercial redistribution rights;
- track upstream security updates.

The repo's `MODELS.md` is a starting point, not proof that every current catalog item is bundled or that all model licenses permit every use. Validate the exact model and binary actually shipped.

## Review gate
No release artifact until a dependency inventory has been reviewed for licensing, provenance, malware scanning, runtime dependencies and redistribution permission.
