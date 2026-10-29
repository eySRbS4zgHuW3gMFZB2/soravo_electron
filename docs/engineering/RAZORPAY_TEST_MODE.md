# Razorpay test-mode validation (P6)

## Scope and safety
- Use only Razorpay test mode for this task. No live payment, live economy, or production database write is permitted as part of validation.
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` belong only in Supabase Edge Function secrets for the `Soravo_fresh` project.
- No password, secret, token, or service-role value should be pasted in chat, source, fixtures, screenshots, CI logs, or Playwright traces.

## Verified for the preview backend (2026-10-28)
- Preview website project: `soravo-web-preview`.
- Supabase project: `Soravo_fresh` (`vfrhplskegqqdxbykyvx`), not the historical `soravo` project.
- Create-order endpoint: `https://vfrhplskegqqdxbykyvx.supabase.co/functions/v1/create-order`
  - Preflight `OPTIONS` returned `200`.
  - Invalid `Authorization: Bearer invalid-token` returned the Supabase gateway's `401 UNAUTHORIZED_INVALID_JWT_FORMAT`.
  - The function is deployed as `create-order`.
- `razorpay-webhook` and `register-device` are also deployed to the same intended project.
- Billing migrations through `005` are applied to `Soravo_fresh`.

## Environment safety gate (owner/operator)
Before live Playwright/Sandbox testing:
1. open Supabase Dashboard for `Soravo_fresh`;
2. confirm `RAZORPAY_KEY_ID` starts with test-mode naming and no live credential is used;
3. confirm function secrets are the only place the Razorpay credentials exist;
4. confirm the frontend bundle is built with only public values (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`);
5. use a dedicated owner-controlled test account, not an ordinary customer's account.

## Strict blocker
No signed-in test account and no owner-controlled test-mode Razorpay flow was available to the agent. Therefore the following were **not** independently verified:
- successful Razorpay test-mode monthly or lifetime payment;
- webhook signature validation with a real signed test event;
- duplicate-event idempotency;
- dashboard reflection of entitlement state;
- failure/cancellation behavior in the browser;
- any actual entitlement creation.

## Owner-operated next steps
1. Add Razorpay test-mode credentials directly to Supabase Edge Function secrets.
2. Create/use a dedicated owner-controlled account.
3. Run the owner-side Playwright procedure with Razorpay's official test instruments and capture sanitized evidence.
4. Report backend records by stable IDs and relevant fields, not merely row counts.
