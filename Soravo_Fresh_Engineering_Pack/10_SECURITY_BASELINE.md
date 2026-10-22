# Security Baseline

## Threat model

Assets: user accounts, entitlement state, payment records, admin actions, release artifacts, signing keys, service secrets and local user data.

Threat actors: unauthenticated web visitors, malicious users, compromised accounts, fraudulent payment callbacks, replayed webhooks, malicious dependency updates, compromised CI action, binary patchers and accidental agent/tool disclosure.

## Mandatory controls

### Identity and sessions
- Supabase Auth configured with exact allowed redirect URLs.
- Desktop auth uses PKCE/one-time code, state/nonce and deep-link validation.
- No JWT/access/refresh token in URL, logs, crash reports or clipboard.
- Refresh token stored in OS credential storage, not plain JSON/SQLite.
- Session revocation and sign-out behavior documented.
- Rate limits for sign-in, recovery, device enrollment and entitlement endpoints.

### Database
- RLS enabled for all tables exposed to clients.
- Test both authorized and unauthorized paths.
- Users can only read/update their own allowed profile/device fields.
- Clients cannot set their own role, plan, payment status, lifetime flag, entitlement expiry or webhook status.
- Admin role cannot be granted through normal user APIs.
- Privileged server functions re-check caller identity and role.
- Production migrations are versioned, reviewed, and have a recovery plan.

### Razorpay
- Verify webhook signatures using current provider specification.
- Reject malformed, invalid-signature and unexpected event types.
- Idempotency prevents duplicate entitlement grants.
- Store minimum necessary payment metadata; never store card details.
- Never trust browser callback, query string, client amount or plan code.
- Reconcile provider state against internal ledger.
- Use separate test/live credentials and webhook endpoints.
- Protect against replay, out-of-order events and retry storms.

### Entitlements
- Server is authority for monthly subscription state.
- Monthly device cap checked atomically.
- Lifetime unlimited devices is a deliberate separate policy path.
- 14-day offline grace applies only to monthly plan.
- Lifetime offline indefinitely after valid activation; disclose that a never-reconnecting device cannot receive remote revocation.
- Renderer cannot flip entitlement by changing a boolean.
- Do not promise DRM-grade protection.

### Web/app security
- Set restrictive CSP; current Tauri config was observed with `csp: null`, so this must be addressed before adding auth/network flows.
- Validate and encode all untrusted input.
- Use secure cookies where applicable; avoid localStorage for long-lived bearer credentials.
- CSRF protections for cookie-authenticated mutation endpoints.
- CORS allowlist only.
- Protect admin APIs server-side; route hiding is not security.
- Keep dependency footprint small and reviewed.
- Prevent open redirects in auth and download flows.

### Secrets and CI
- Never commit `.env`, service role keys, Razorpay secrets, Resend SMTP password, Cloudflare API token or signing private key.
- Use GitHub Actions secrets/environments or provider secret store.
- Least privilege for tokens and workflows.
- Do not expose secrets to untrusted PR code.
- Enable secret scanning/push protection if available.
- CodeRabbit and external agents receive only sanitized diffs.

### Release integrity
- SHA-256 checksum for every published artifact.
- Optional minisign signature, private key offline and never in CI.
- Tauri updater signing key is distinct from OS code signing.
- Self-signed Windows certificate does not eliminate SmartScreen warning.
- Linux checksum verifies byte integrity only if checksum source is trusted.
- Publish release artifact hash in a separate trusted place if threat model requires stronger assurance.

## Incident response
If a secret is exposed:
1. Stop and identify affected credential without repeating it.
2. Revoke/rotate immediately in the provider dashboard.
3. Remove it from future source history where possible; do not assume deleting the current file erases Git history.
4. Audit logs and use them to assess impact and scope.
5. Notify affected users/regulators if legally required after qualified assessment.
6. Record a sanitized incident report and prevention action.

## Security gates
No release if critical/high vulnerabilities remain unexplained, webhook signature verification is untested, RLS policies lack negative tests, secrets are found in repo, or a user can self-promote to admin.
