# Test and Benchmark Protocol

## Test pyramid

1. Unit tests for domain/state transitions, device cap, price/plan mapping, URL/code validation, webhook idempotency.
2. Integration tests for database/RLS, migrations, API contracts and webhook signature validation.
3. Desktop integration tests for browser callback, OS credential storage, entitlement cache and local-only dictation.
4. Playwright E2E for public site, account flows, dashboard and admin denial.
5. Clean-install manual tests on Windows, and on Linux once a Linux engine exists.
6. Release acceptance on a clean VM without development tools.

## Required cases

### Auth
- signup with valid/invalid email;
- confirmation link valid, expired, replayed, wrong redirect;
- sign-in/out and account switch;
- lost network during callback;
- browser closed/cancelled;
- invalid custom protocol parameters;
- refresh token missing/revoked;
- user A cannot read or mutate user B data.

### Device limits
- monthly devices 1, 2, 3 allowed; fourth denied with a clear replacement path;
- simultaneous enrollment attempts cannot exceed 3;
- revoked device rejected on next online check;
- lifetime plan can register more than 3 devices;
- no hardware fingerprinting.

### Entitlement/offline
- valid monthly plan online;
- network loss day 1 and day 14;
- after grace expires, paid feature blocked but local data remains;
- lifetime activation followed by indefinite offline use;
- expired/revoked lifetime behavior follows approved policy;
- wall-clock rollback, forward jump, suspend/resume and corrupt cache;
- server 401/403/429/500 and malformed JSON;
- older/newer entitlement schema versions.

### Razorpay
- valid signature, invalid signature, missing signature;
- duplicate webhook;
- out-of-order events;
- subscription charged/renewed/cancelled/halted/expired according to current provider event list;
- delayed webhook and browser return before webhook;
- refund/chargeback and manual reconciliation;
- amount/currency mismatch;
- provider timeout and retry.

### Release/desktop
- Windows installer includes CrispASR and all runtime DLLs, taken from a git-tracked source path;
- **clean-machine install** with no developer tools and no source tree: the app finds and launches the bundled engine, with no developer-only fetch step, and can dictate;
- the installer is inspected for the engine's presence rather than inferred from its size;
- required runtime dependencies are present on a machine with no build toolchain;
- no developer tools needed on clean VM;
- first-run model path valid;
- offline transcription works;
- hotkey works with Soravo focused and another app focused;
- hold/release, toggle, cancel, paste/copy and text injection;
- Linux microphone permissions/dependencies and text injection — blocked until task P1-05 delivers a Linux engine;
- checksum verification on downloaded artifacts;
- the live production site is confirmed unchanged when a release is produced from a repository whose identity changed.

### Website
- mobile/desktop viewport, keyboard-only navigation, focus visibility, reduced motion, contrast;
- broken links, 404, metadata, legal pages;
- auth forms with server errors and loading states;
- admin direct URL/API denied to normal user;
- no production secrets in built JS/source maps.

## CI quality gates

- Frontend typecheck/build.
- Rust format/clippy/tests.
- Website unit and Playwright tests.
- Migration/RLS checks in isolated environment.
- Dependency and secret scan.
- Package artifact smoke check.
- CodeRabbit review on substantive diffs, findings triaged.
- Release checksums recomputed and verified.

## Benchmarking transcription

Commercial auth work must not change ASR behavior. Before/after a release-critical desktop change, run a small fixed corpus and compare:
- word error rate on representative supported languages/accents;
- latency from release of hotkey to text insertion;
- model load time and memory;
- CPU use on target hardware;
- regression in cleanup/custom vocabulary;
- no audio/transcript sent to commercial services.
Keep test audio consented/synthetic or otherwise legally authorized; avoid uploading private transcripts to third-party review systems.
