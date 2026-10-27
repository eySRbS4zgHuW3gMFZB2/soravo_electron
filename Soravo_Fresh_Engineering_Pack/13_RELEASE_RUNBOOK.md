# Release Runbook

## Release principles

- Never release from an unreviewed branch.
- Every release is tied to an immutable Git tag and commit.
- Build artifacts in clean CI runners and preserve logs.
- No release if clean-install packaging fails. A clean-machine install with no developer tools and no source tree must prove the app locates and launches the bundled engine (`ADR-0010`).
- Windows must have a verified artifact and checksum. Linux must as well **once a Linux engine exists** (task P1-05); until then Linux is BLOCKED and no Linux artifact may be published.
- Public release assets must not expose source code unless the owner deliberately chooses that.
- The binary host is governed by **ADR-0005**, which is ACCEPTED for the public `soravo-releases` artifacts-only repository. Publishing still requires clean-machine verification and owner approval; the Linux release gate applies when publishing Linux artifacts.
- The live production site at `soravo.xyz` is not touched by a desktop release. Website deployment and desktop release are separate concerns with separate rollback paths.

## Accepted release repository

ADR-0005 selects `eySRbS4zgHuW3gMFZB2/soravo-releases`, public, contains only:
- release assets;
- SHA256SUMS;
- release notes;
- optional minisign signature/public key;
- no source tree, secrets, environment files, internal docs or debug symbols unless deliberately scrubbed.

The active source repo can become private before commercial launch. Release repository is separate so public download links work without customer GitHub authentication. The host decision is accepted in ADR-0005; `14_FREE_BINARY_HOSTING_OPTIONS.md` records the alternatives considered.

## Version process

1. Confirm `main` clean and all required CI green.
2. Review CodeRabbit results and resolve critical/high findings.
3. Update version in the app config/package files consistently.
4. Update changelog/release notes.
5. Create annotated tag such as `v0.2.0` only after approval.
6. Build artifacts in CI for every platform that has a supported engine. Windows always. Linux: a **verification build** is permitted once task P1-05 has delivered a Linux engine, because the Linux release gate cannot be satisfied without one; **publishing** a Linux artifact, and describing Linux as supported, stay prohibited until that gate has passed.
7. Inspect artifact contents for secrets, test data and missing runtime files.
8. Generate checksums:
   `sha256sum Soravo_0.2.0_x64-setup.exe Soravo_0.2.0_x64_en-US.msi > SHA256SUMS` (Linux) or an equivalent PowerShell `Get-FileHash -Algorithm SHA256` flow on Windows. Two rules govern the command:
   - **Use the published asset names, without a path prefix.** An entry such as `dist/Soravo_0.2.0_x64-setup.exe` makes `sha256sum -c SHA256SUMS` fail from a clean download directory, because the `dist/` directory does not exist there. Run the command from the directory holding the published assets, so the entries are bare filenames.
   - **Cover every installer that is actually published.** A release may ship only one format, and only the formats that exist are listed. Do not use a fixed two-file list for a one-file release, and do not omit a format that is published.

   Never use a placeholder such as `<artifact files>`, which the shell reads as input redirection. Every installer that is published must have a checksum entry, or Step 9 cannot verify it.
9. Verify checksums from downloaded artifacts.
10. Upload artifacts and checksums to a **private or draft staging release** on the release host. **Do not publish them to a customer-accessible location yet.** A broken installer that customers can download is worse than a delayed release, and the clean-machine gate below is a release blocker.
11. Verify the staged links resolve for the release account, without making the assets customer-accessible.
12. Test installation on a clean machine: the installer launches, locates the bundled engine, and dictates. **This gate must pass before publication**, because it is what proves the release is not broken.
13. Upload the verified artifacts and checksums to the public release host **as a draft**, so the bytes are hosted but not yet customer-accessible.
14. **Verify the hosted draft**, not the local build: download the artifact from the host and verify its SHA-256 against `SHA256SUMS`. Step 13 uploads a new copy, so the artifact tested at step 12 is not the one the host will serve, and an upload can change or corrupt it. Only after the hosted copy verifies is the draft published.
15. Publish the draft, then **re-check the public links and download the published asset once more from a logged-out browser**. A link that resolves is not a link that serves the verified bytes.
16. Publish release notes and installation/trust-warning guidance.
17. Update `latest` manifest only after the release is verified.
18. Update progress/handoff and record commit/tag/hash.

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
