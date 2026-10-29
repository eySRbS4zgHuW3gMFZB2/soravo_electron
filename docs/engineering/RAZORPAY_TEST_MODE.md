# Razorpay test-mode validation (P6)

## Scope and safety

- Use only Razorpay test mode for this task. No live payment, live economy, or production database write is permitted as part of validation.
- Store `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in Supabase Edge Function secrets for the `Soravo_fresh` project.
- Store `RAZORPAY_WEBHOOK_SECRET` in the same Supabase Edge Function secrets and configure the identical value as the secret for the Razorpay test-mode webhook.
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
3. confirm the API credentials are configured in Supabase Edge Function secrets and the webhook secret matches the Razorpay test-mode webhook configuration;
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

1. Add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` directly to Supabase Edge Function secrets for `Soravo_fresh`; set `RAZORPAY_WEBHOOK_SECRET` there and use the identical value for the Razorpay test-mode webhook secret.
2. Create/use a dedicated owner-controlled account.
3. Run the owner-side Playwright procedure with Razorpay's official test instruments and capture sanitized evidence.
4. Report backend records by stable IDs and relevant fields, not merely row counts.

## Owner-operated manual test procedure

1. Configure `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in Supabase Edge Function secrets for `Soravo_fresh`. Set `RAZORPAY_WEBHOOK_SECRET` there and configure the identical value as the secret for the Razorpay test-mode webhook pointing to `https://vfrhplskegqqdxbykyvx.supabase.co/functions/v1/razorpay-webhook`.
2. Run the website locally against the intended Fresh project variables.
3. Confirm the key begins with test-mode prefix (prefix only; never log or expose full secret).
4. Use a dedicated test account in an owner-controlled browser session.
5. Start monthly checkout and verify the request payload is POST /functions/v1/create-order with plan_code: monthly.
6. Complete payment only with Razorpay's official current Test Mode instruments; do not invent card numbers, CVV, OTP, or amount.
7. Return through the normal redirect and confirm the account page does not show a paid entitlement before the signed webhook is processed.
8. Trigger the Razorpay test webhook or provide the owner-generated signed event to the deployed webhook endpoint.
9. Verify an invalid signature returns 401, duplicate delivery is idempotent, and payments, subscriptions, and entitlements have exactly one expected record with the expected plan.
10. Repeat lifetime with the approved one-time amount and verify unlimited/ex indefinite offline entitlement semantics.
11. Check failure/cancellation and refresh of the return URL.
12. Never include real credentials, tokens, live payment identifiers, or payload secrets in evidence.

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

## Deployed diagnostics (2026-10-29 continuation)

- Redeployed create-order as hosted version 4; monthly 502 responses now include sanitized Razorpay provider_status, provider_error_code, provider_error_description, and provider_error_reason.
- Finalize webhook payment atomic function (hosted database) was restored as an additive CREATE OR REPLACE migration via MCP.
- Lifetime webhook event was reprocessed successfully; payment is captured and one lifetime entitlement exists.
- Monthly create-order was previously 502; owner should retry and report provider response fields.
