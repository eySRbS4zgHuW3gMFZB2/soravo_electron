# Commercial Rules and Entitlement State Machine

## Approved plan contract

| Plan | Price | Billing | Device policy | Offline policy |
|---|---:|---|---|---|
| Monthly | $12 | Recurring monthly | Maximum 3 active devices | 14-day grace after last successful verification |
| Lifetime | $50 | One-time | Unlimited | Indefinite offline operation after valid activation |
| Enterprise | Not available | Deferred | Not defined | Not defined |

These prices are product decisions, not a statement that Razorpay will support every currency or region. Confirm the actual checkout currency and displayed total before launch.

## State machine (minimum)

Entitlement states: `unactivated`, `active`, `grace`, `expired`, `payment_pending`, `payment_failed`, `revoked`, `lifetime_active`, `support_review`.

- `unactivated`: no valid entitlement has been issued.
- `active`: server confirms current monthly subscription.
- `grace`: server cannot currently confirm status, but last successful verification is within the 14-day policy window.
- `expired`: subscription has ended and grace has elapsed.
- `payment_pending`: checkout started; no entitlement until verified server-side payment event.
- `payment_failed`: payment failed or renewal was not collected; apply the defined grace/cure policy.
- `revoked`: account/license revoked through an authorized administrative action or confirmed fraud/refund policy.
- `lifetime_active`: valid lifetime entitlement. Unlimited device registrations and no periodic online expiry.
- `support_review`: inconsistent provider state or disputed transaction; never silently upgrade entitlement.

## Required transitions

1. Browser return/checkout success is informational only; it does not grant a plan.
2. Verified Razorpay webhook + idempotent processing creates/updates a payment record and entitlement.
3. Duplicate webhook event must not create duplicate licenses or sales.
4. Subscription renewal success moves to `active` and resets verification timestamp.
5. Failed renewal does not instantly erase user data. Apply a documented grace/cure policy and notify the user where possible.
6. After 14-day offline grace, monthly paid features are disabled if server remains unreachable or entitlement is expired; local history remains accessible/exportable.
7. Lifetime license remains usable offline indefinitely after valid activation. Remote revocation cannot be enforced on a device that never reconnects; disclose this operational limitation.
8. Device removal must be authenticated and auditable. Monthly device count must be checked atomically server-side to avoid race conditions.

## Device identity and limits

A device ID must be generated randomly and stored locally; do not derive it from a hardware serial number, MAC address, or invasive fingerprint. Store a device label/platform/app version/last seen timestamp. Treat device ID as a pseudonymous identifier and document it in the privacy policy.

Monthly: maximum 3 active devices. Define a safe device-replacement flow when a user has reached the limit. Lifetime: unlimited devices; still allow device listing and revocation UI if useful, but do not accidentally enforce the monthly cap.

## Clock and offline behavior

- Store `last_successful_check_at` and signed entitlement metadata.
- Protect the local cache from trivial modification where practical, but do not describe client-side storage as unbreakable DRM.
- Use monotonic time where available during a session; wall-clock rollback handling must fail safely without unexpectedly locking users out after ordinary time correction.
- Cache a server-issued signed entitlement with plan, user/account ID, issue time, expiry/check-after policy, and schema version.
- Never embed signing private keys in the desktop app.
- For lifetime, cache a durable verified entitlement and do not require a periodic heartbeat for normal use.
- Document reinstall, OS reinstall, device migration, and account recovery behavior before launch.

## Refunds, chargebacks, cancellations

Before payments are enabled, the owner must approve:
- refund eligibility/window and contact process;
- cancellation timing (end of current billing period vs immediate);
- treatment of chargebacks and disputed payments;
- lifetime refund effect on entitlement;
- statutory consumer rights applicable to each selling region.

Do not invent refund law or claim that Soravo's policy overrides local law. Get qualified advice for legal/tax questions.
