# Web-Desktop Authentication Contract

## Overview

The Soravo desktop app authenticates via the system browser, not an embedded webview.
This document defines the secure callback/session exchange between the website and desktop app,
using a PKCE-style verifier so the desktop app proves possession of the auth session.

## Flow

1. **Desktop generates PKCE verifier:** The desktop app generates a high-entropy `code_verifier`
   and stores it locally. It computes `code_challenge = BASE64URL(SHA256(code_verifier))` with
   method `S256`.
2. **Desktop initiates auth:** Desktop app opens the system browser to
   `https://soravo.xyz/auth/desktop?state=<random_state>&code_challenge=<s256_challenge>&code_challenge_method=S256&redirect=soravo://auth/callback`
3. **User authenticates in browser:** Supabase Auth handles login/signup in the browser.
   The server stores the `state` and `code_challenge` against the pending flow.
4. **Server generates one-time code:** After successful auth, the server creates a short-lived
   (60s), single-use code bound to the user session and to the stored `code_challenge`.
5. **Browser redirects to desktop:** Browser redirects to
   `soravo://auth/callback?code=<one_time_code>&state=<random_state>`
6. **Desktop exchanges code:** The desktop app sends the code **and its stored `code_verifier`**
   to the server's token exchange endpoint.
7. **Server validates verifier:** The server recomputes `BASE64URL(SHA256(code_verifier))`,
   compares it to the stored `code_challenge`, and only then issues a session token
   (refresh token stored in OS credential storage). A verifier that does not match the
   stored challenge is rejected.

## Security Requirements

- The one-time code is single-use and expires in 60 seconds
- The `code_verifier` is generated with high entropy (≥ 64 random bytes) and never sent in a URL
- State/nonce is verified to prevent CSRF
- The server validates the `code_verifier` against the stored `code_challenge` during token exchange
- No bearer token or refresh token in the deep link URL
- Deep link parameters are validated server-side
- Refresh tokens stored in OS credential storage (not plain JSON/SQLite)
- Desktop app verifies the code server-side before granting access

## Deep Link Scheme

- Scheme: `soravo://`
- Callback path: `soravo://auth/callback`
- Parameters: `code` (one-time code), `state` (CSRF token)

## Implementation Status

- [ ] Deep link registration in Tauri config
- [ ] System browser auth flow in desktop app
- [ ] PKCE verifier/challenge generation in desktop app
- [ ] One-time code generation endpoint (server-side), bound to challenge
- [ ] Token exchange endpoint (server-side) with verifier validation
- [ ] OS credential storage integration
- [ ] State/nonce verification

## Notes

- The desktop app does NOT embed a webview for auth
- The system browser is used to ensure the user's existing session/cookies are available
- The one-time code + PKCE pattern prevents token leakage in URLs/logs
- The verifier never leaves the desktop app except in the server-side token exchange request
