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

## Owner-operated manual test procedure
1. Run the website locally against the intended Fresh project variables.
2. Confirm the key begins with test-mode prefix (prefix only; never log or expose full secret).
3. Use a dedicated test account in an owner-controlled browser session.
4. Start monthly checkout and verify the request payload is POST /functions/v1/create-order with plan_code: monthly.
5. Complete payment only with Razorpay's official current Test Mode instruments; do not invent card numbers, CVV, OTP, or amount.
6. Return through the normal redirect and confirm the account page does not show a paid entitlement before the signed webhook is processed.
7. Trigger the Razorpay test webhook or provide the owner-generated signed event to the deployed webhook endpoint.
8. Verify an invalid signature returns 401, duplicate delivery is idempotent, and payments, subscriptions, and entitlements have exactly one expected record with the expected plan.
9. Repeat lifetime with the approved one-time amount and verify unlimited/ex indefinite offline entitlement semantics.
10. Check failure/cancellation and refresh of the return URL.
11. Never include real credentials, tokens, live payment identifiers, or payload secrets in evidence.

## Observed owner-run test (2026-10-29)
- Lifetime order: order_Ttc4iiqMgCDcgn
- Lifetime payment: pay_Ttc5fbmkjZRZQb, USD 5000, pending before webhook
- Received webhook event: payment.captured for the above payment
- Signature verification: valid
- Previously missing server function inalize_webhook_payment_atomic prevented entitlement grant; deployment of that function corrected this
- Monthly create-order returned HTTP 502 with Failed to create subscription; no subscription or payment was recorded
- Owner-managed next action: resend/replay the failed lifetime webhook from Razorpay Test Dashboard after applying the corrected function, then confirm entitlements
- Owner-managed monthly action: retry monthly checkout and capture the exact Razorpay status/error shown in the browser network tab and function logs
## Observed owner-run test (2026-10-29)
- Lifetime order: order_Ttc4iiqMgCDcgn
- Lifetime payment: pay_Ttc5fbmkjZRZQb, USD 5000, pending before webhook
- Received webhook event: payment.captured for the above payment
- Signature verification: valid
- Previously missing server function finalize_webhook_payment_atomic prevented entitlement grant; deployment of that function corrected this
- Monthly create-order returned HTTP 502 with Failed to create subscription; no subscription or payment was recorded
- Owner-managed next action: resend/replay the failed lifetime webhook from Razorpay Test Dashboard after applying the corrected function, then confirm entitlements
- Owner-managed monthly action: retry monthly checkout and capture the exact Razorpay status/error shown in the browser network tab and function logs
