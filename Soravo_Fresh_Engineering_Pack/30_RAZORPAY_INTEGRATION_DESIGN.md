# Razorpay Integration Design

## Status: DESIGN ONLY — Not yet implemented

## Prerequisites (before implementation)

1. Razorpay account with API keys (test + live)
2. Webhook endpoint configured in Razorpay dashboard
3. Webhook secret for signature verification
4. Server-side API backend chosen (ADR-0003: Cloudflare Pages Functions vs Supabase Edge Functions — PROPOSED)

## Integration Architecture

### Server-Side Components

1. **Order/Subscription Creation Endpoint**
   - Creates Razorpay order or subscription server-side
   - Never trust client-supplied amount, plan, or user ID
   - Returns order_id/subscription_id to client for Checkout

2. **Webhook Endpoint**
   - Receives Razorpay webhook events
   - Verifies webhook signature using HMAC-SHA256 with webhook secret
   - Processes events idempotently (keyed by provider_event_id)
   - Creates/updates payment records and entitlements

3. **Idempotency Ledger**
   - Table: `webhook_events` (provider, provider_event_id, event_type, received_at, signature_valid, processing_status, processed_at, error_code)
   - Duplicate events must not create duplicate licenses or sales
   - Processing status: received → processing → processed | failed | duplicate

### Payment Flow

1. User selects plan on website → calls server to create Razorpay order/subscription
2. Server creates order with verified amount/plan → returns order_id
3. Client opens Razorpay Checkout with order_id
4. User completes payment in Razorpay
5. Razorpay sends webhook to server
6. Server verifies webhook signature
7. Server creates payment record (idempotent)
8. Server creates/updates entitlement (only after verified payment)
9. Browser return/checkout success is informational only — does NOT grant entitlement

### Entitlement Provisioning

- Monthly ($12): Creates `active` entitlement, max 3 devices, 14-day offline grace
- Lifetime ($50): Creates `lifetime_active` entitlement, unlimited devices, indefinite offline
- Renewal: Subscription renewal success → `active`, reset verification timestamp
- Failure: Failed renewal → `payment_failed`, apply grace/cure policy
- Refund/chargeback: Apply defined policy, update entitlement status

### Device Limits

- Monthly: max 3 active devices, checked atomically server-side
- Lifetime: unlimited devices
- Device ID: randomly generated, stored locally, not derived from hardware
- Device replacement flow needed when monthly limit reached

### Offline Grace

- Monthly: 14-day grace after last successful verification
- Lifetime: indefinite offline after valid activation
- Cache signed entitlement with plan, user ID, issue time, expiry policy, schema version
- Never embed signing private keys in desktop app

### Security Requirements

- Service-role key never exposed to client
- Razorpay key secret and webhook secret are server secrets only
- All privileged operations verified server-side
- Rate-limit auth, device registration, license checks, webhook failure paths
- Log outcomes and correlation IDs, never tokens/secrets/audio/transcripts

### Next Implementation Task

1. Choose backend placement (ADR-0003): Cloudflare Pages Functions vs Supabase Edge Functions
2. Implement server-side order creation endpoint
3. Implement webhook verification and processing
4. Implement entitlement provisioning
5. Add device registration/limit checking
6. Add automated tests for all flows