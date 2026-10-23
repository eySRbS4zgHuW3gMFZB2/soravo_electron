# Web-Desktop Authentication Contract

## Overview
The Soravo desktop app authenticates via the system browser, not an embedded webview.
This document defines the secure callback/session exchange between the website and desktop app.

## Flow

1. **Desktop initiates auth:** Desktop app opens the system browser to `https://soravo.xyz/auth/desktop?state=<random_state>&redirect=soravo://auth/callback`
2. **User authenticates in browser:** Supabase Auth handles login/signup in the browser
3. **Server generates one-time code:** After successful auth, the server creates a short-lived (60s), single-use code bound to the user session
4. **Browser redirects to desktop:** Browser redirects to `soravo://auth/callback?code=<one_time_code>&state=<random_state>`
5. **Desktop exchanges code:** Desktop app sends the code to the server's token exchange endpoint
6. **Server returns session:** Server validates the one-time code and returns a session token (refresh token stored in OS credential storage)

## Security Requirements

- The one-time code is single-use and expires in 60 seconds
- State/nonce is verified to prevent CSRF
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
- [ ] One-time code generation endpoint (server-side)
- [ ] Token exchange endpoint (server-side)
- [ ] OS credential storage integration
- [ ] State/nonce verification

## Notes

- The desktop app does NOT embed a webview for auth
- The system browser is used to ensure the user's existing session/cookies are available
- The one-time code pattern prevents token leakage in URLs/logs