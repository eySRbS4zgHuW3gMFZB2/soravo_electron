# Release Runbook

## Release principles

- Never release from an unreviewed branch.
- Every release is tied to an immutable Git tag and commit.
- Build artifacts in clean CI runners and preserve logs.
- No release if clean-install packaging fails. A clean-machine install with no developer tools and no source tree must prove the app locates and launches the bundled engine (`ADR-0010`).
- Windows must have a verified artifact and checksum. Linux must as well **once a Linux engine exists** (task P1-05); until then Linux is BLOCKED and no Linux artifact may be published.
- Public release assets must not expose source code unless the owner deliberately chooses that.
- The binary host is governed by **ADR-0005**, which is currently PROPOSED. Publishing before that ADR is ACCEPTED is not permitted.
- The live production site at `soravo.xyz` is not touched by a desktop release. Website deployment and desktop release are separate concerns with separate rollback paths.

## Proposed release repository

Preferred candidate: `eySRbS4zgHuW3gMFZB2/soravo-releases`, public, contains only:
- release assets;
- SHA256SUMS;
- release notes;
- optional minisign signature/public key;
- no source tree, secrets, environment files, internal docs or debug symbols unless deliberately scrubbed.

The active source repo can become private before commercial launch. Release repository is separate so public download links work without customer GitHub authentication. This is a candidate, not a settled choice — see `14_FREE_BINARY_HOSTING_OPTIONS.md` and the ADR-0005 acceptance criteria.

## Version process

1. Confirm `main` clean and all required CI green.
2. Review CodeRabbit results and resolve critical/high findings.
3. Update version in the app config/package files consistently.
4. Update changelog/release notes.
5. Create annotated tag such as `v0.2.0` only after approval.
6. Build artifacts in CI for every platform that has a supported engine. Windows always; Linux only once task P1-05 has delivered a Linux engine and the Linux release gate in `05_IMPLEMENTATION_PLAN.md` has passed. Do not build or publish a Linux artifact before then.
7. Inspect artifact contents for secrets, test data and missing runtime files.
8. Generate checksums:
   `sha256sum Soravo_0.2.0_x64-setup.exe Soravo_0.2.0_x64_en-US.msi > SHA256SUMS` (Linux) or an equivalent PowerShell `Get-FileHash -Algorithm SHA256` flow on Windows. Use explicit artifact paths, or a glob that covers **every** published installer — `sha256sum dist/*.exe dist/*.msi > SHA256SUMS`, not a glob that covers only one extension. Never use a placeholder such as `<artifact files>`, which the shell reads as input redirection. Every installer that is published must have a checksum entry, or Step 9 cannot verify it.
9. Verify checksums from downloaded artifacts.
10. Upload artifacts and checksums to the public release host.
11. Verify public links from a logged-out browser.
12. Test installation on a clean machine.
13. Publish release notes and installation/trust-warning guidance.
14. Update `latest` manifest only after the release is verified.
15. Update progress/handoff and record commit/tag/hash.

## Self-signing and trust

- SHA-256 checksums detect accidental/corrupt downloads only when compared with a trustworthy checksum.
- Self-signed Windows signing may identify the signing certificate after the user inspects it but generally does not establish public trust or remove SmartScreen warnings.
- Linux commonly relies on package manager/distribution trust, signatures and checksums; do not call self-signing a universal installation standard.
- Public macOS release is not in launch scope.
- If Tauri updater is later used, configure its updater signature separately and protect its private key.
- Do not claim “verified publisher” or “no warnings” when not true.

## Rollback
- Keep prior release assets and immutable tags.
- If a web deployment breaks, roll back website deployment independently of desktop release.
- Do not silently repoint an already published version to different bytes.
- If a release has a security issue, mark it withdrawn, publish advisory/instructions and release a fixed version.
- **Website cutover rollback is a separate procedure** with its own prerequisites and rehearsal requirement; see `27_PRODUCTION_CUTOVER_AND_ROLLBACK.md`. Do not repoint the production hostname without owner approval at that moment.
