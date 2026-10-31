# Wispr Flow onboarding reverse-engineering notes

## Summary

- Inspected installed Wispr Flow version `1.6.1337` from `C:\Users\kaya\AppData\Local\WisprFlow\app-1.6.1337`.
- Framework: Electron (resources include `resources.pak`, Chromium support DLLs, `app.asar`, and preload/AX scripts).
- Primary JavaScript bundle: `resources/app.asar`.
- REA analysis ID: `ev_3367ac70bb6c029e4d610fde5cb97e22dfbfaccdb3c0bdd23a3c204dd2baccaf`.
- ASAR integrity: one recorded mismatch for unpacked SQLite native binary (`node_sqlite3.node`), analyzed with `record-and-continue`.
- Onboarding-related strings and flags exist in the bundle (`settings_testing_item_restart_onboarding`, `settings_testing_item_preserve_intents`, `personalization`, `plans`, `login`, `account`).

## Tooling

- REA `analyze_javascript_application` with summary detail.
- Browser UI automation was not used to traverse the live app in this pass; screenshots, bundled strings and REA static analysis were used.
- Ghidra was not applied to Electron's bundled JS bundle; no standalone native binary beyond Electron/Chromium was inspected here.

## Observed behavioral evidence

- The application is an Electron package with a large renderer/main bundle and preload capability.
- String inventory contains extensive plan, billing, team, onboarding, personalization, and account settings.
- Onboarding testing strings include a restart-onboarding option and preserving onboard intents.
- Plan and billing copy indicates lifetime/pro/team plans and entitlement states.
- Locale text shows auth-related language but the exact flow was not determined from strings alone.

## Confirmed versus inferred

Confirmed:
- Installed app version `1.6.1337`.
- Electron framework through packaged Chromium resources and ASAR.
- ASAR application graph recovered, with 212 parsed JavaScript files and no parse failures.
- The bundle contains onboarding, account, plan and permission-related UI states.

Inferred:
- The onboarding likely uses a sequential first-run path (`SIGN UP -> PERMISSIONS -> SET UP -> LEARN -> PERSONALIZE`) from owner-provided screenshot evidence.
- A browser-mediated handoff may be used because the strings contain login/SSO-related concepts, but an actual secure callback dance was not confirmed from static strings alone.

Unknowns:
- Exact deep-link protocol and callback implementation.
- Exact credential/session storage.
- Exact browser launch and auth roundtrip.
- Permission sequence and OS surfaces.
- Tutorial implementation.

## SORAVO design implications

- Reproduce the observed flow with SORAVO's own design language.
- Preserve local-first behavior.
- Keep Supabase Auth only for identity and entitlements.
- Use secure OS storage later for sessions.
- Do not copy Wispr Flow assets or source.
