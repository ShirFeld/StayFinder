# Stripe Sandbox Payments

## User Flow

Sign in -> choose accommodation and dates -> check availability -> continue to Stripe Checkout -> pay with a test card -> return to StayFinder -> server verifies the payment -> booking confirmation.

A quote alone does not reserve dates. Continuing to payment creates a temporary checkout hold, not a booking. New rows in `bookings` are created only after the server retrieves a completed, paid session from Stripe and verifies its sandbox mode, identity, metadata, amount, and currency. The former direct `POST /api/bookings` endpoint returns `409 PAYMENT_REQUIRED`.

## Local Setup

The current checkout has already been connected to a temporary Stripe sandbox. Its secret key and webhook signing secret are in ignored `server/.env`. The private claim link and expiration date are in ignored `server/data/stripe/stripe-sandbox-access.md`. The original temporary claim deadline was October 24, 2026. The owner reported completing the claim on October 17, and the existing sandbox key was subsequently verified successfully. Do not commit credentials or share the claim link.

Run these commands from the project root. Use two terminals:

```powershell
# Terminal 1: keep this running for payment and refund event delivery.
npm run payments:listen
```

```powershell
# Terminal 2: keep the frontend and API running.
npm run dev
```

Open http://localhost:5173. Start the listener first: it saves its signing secret to `server/.env` if needed. If it reports a changed secret while the API is running, restart `npm run dev`. The listener uses the official Stripe CLI installed as a development dependency; it forwards events to the configured API port and hides signing secrets in its output.

For a fresh clone, install dependencies, migrate/seed the database as described in README, and configure your own Stripe sandbox key in `server/.env`:

```dotenv
STRIPE_SECRET_KEY=your_sandbox_secret_key
STRIPE_WEBHOOK_SECRET=your_local_listener_signing_secret
CHECKOUT_ORIGIN=http://localhost:5173
```

Actual supported key prefixes are `sk_test_`, `rk_test_`, and the temporary sandbox's `rkcs_test_`. Live keys are rejected at startup. No publishable key is needed for hosted Checkout. The `payments:listen` command uses the secret from this file through the child process environment, not shell arguments.

For the built application on port 3001, set `CHECKOUT_ORIGIN=http://localhost:3001`, restart the API, and start a new checkout. Callback origins are stored with each checkout so retrying an old request retains identical provider parameters.

## Test Cards

Use test cards only, a future expiry date, any three-digit CVC, and a name. If requested, enter a valid test postal code.

| Card                  | Scenario                          |
| --------------------- | --------------------------------- |
| `4242 4242 4242 4242` | Successful payment                |
| `4000 0000 0000 0002` | Declined card                     |
| `4000 0025 0000 3155` | Authentication challenge scenario |

The third scenario is available for manual practice; it is not part of the automated verification reported here. No real funds move in the sandbox. StayFinder never receives or stores card numbers or CVC values; the hosted Stripe page collects them.

## Holds and Availability

Checkout creation runs in an immediate SQLite transaction. It validates dates, guests, active property, availability, and a server-calculated USD price. It snapshots dates, guests, nightly price, total, property name, email, return origin, and provider expiry in `checkouts`.

The provider session expires approximately **31 minutes** after checkout creation. Stripe requires at least 30 minutes for its configurable session expiry. A checkout whose provider creation response is uncertain initially reserves one extra minute as a safety margin; a known session uses the provider's exact expiry. The schema and availability queries consider both confirmed bookings and unexpired `creating`/`open` holds. Checkout remains exclusive: arrival on another booking's departure day is allowed.

There is a maximum of five unexpired active checkouts per user. This bounds abandoned holds in this small demonstration. The UI offers pending checkout recovery from My Bookings. A declined card leaves the session open for another attempt; it does not create a booking or immediately release the hold. Returning through Stripe's cancel link requests cancellation and expires the provider session before dates are released. A provider outage preserves the cancellation intent and keeps the still-payable hold until safe release or expiry.

The active hold protects availability while payment is attempted. If payment is only processed locally after the hold has expired, after cancellation, after the unit/user was disabled, after a capacity reduction below the guest count, or after a conflicting reservation became valid, no new booking is created and a full test refund is requested. This compensates for delayed payment delivery without displacing another customer's reservation.

## Payment Verification and Recovery

Three paths use the same idempotent verification logic in `server/src/payments.ts`:

1. A signed Stripe webhook, independent of browser return.
2. The authenticated owner's `POST /api/checkouts/:id/sync` request from the return/recovery page.
3. A background reconciliation loop in `server/src/index.ts`, running on startup and every 15 seconds while the API is running.

The webhook route uses the raw request body before Express JSON parsing. Stripe's SDK verifies the signature and timestamp. Live events are rejected. Browser query parameters such as `payment=returned` only affect presentation; they never establish payment success.

A unique checkout ID associates the provider session, hold, and eventual booking. Checkout creation requires an `Idempotency-Key` header. Retrying the same key with identical inputs returns the same checkout; changing inputs returns `409 IDEMPOTENCY_CONFLICT`. The provider receives a stable idempotency key as well. The unique `bookings.checkout_id` index and immediate transaction prevent duplicate bookings when a webhook and browser return arrive together.

An uncertain network response does not imply failure at the provider. The durable checkout can be retried with the same key or recovered through My Bookings. Unfinished payments/refunds are rechecked after server restart. Availability expiry is evaluated by database time, so an expired hold stops blocking without waiting for the background loop.

## Cancellation and Full Refund

The first booking cancellation is allowed only before its check-in business day, using `APP_TIMEZONE`. Only the owner can cancel. The server first commits cancellation and refund intent, releases the dates, and then requests a full Stripe refund with a stable idempotency key.

| Booking payment status | Meaning                                                           |
| ---------------------- | ----------------------------------------------------------------- |
| `paid`                 | Sandbox payment verified; booking confirmed                       |
| `refund_pending`       | Cancellation recorded; full refund awaiting provider confirmation |
| `refunded`             | Provider confirmed the full refund                                |
| `refund_failed`        | Provider reported a failed refund; the user can retry             |
| `legacy`               | Booking predates payment integration; no Stripe payment to refund |

A provider outage does not undo a committed cancellation. The UI distinguishes pending/failed refunds from completed refunds. Repeating cancellation preserves the original timestamp and does not create duplicate refunds. Pending refunds reuse the same request. A known failed refund can be explicitly retried with a new attempt key. Recovery remains allowed after check-in if cancellation was already validly recorded before the cutoff.

Existing bookings remain intact after migration and are marked `legacy`. They retain their old cancellation behavior without attempting to refund a payment that never occurred.

## API and Storage

- `POST /api/checkouts`: create/retry a hold and hosted Checkout session.
- `GET /api/checkouts`: latest 50 owned checkouts.
- `GET /api/checkouts/:id`: read owned checkout state.
- `POST /api/checkouts/:id/sync`: verify provider state and fulfill/refund safely.
- `POST /api/checkouts/:id/cancel`: cancel an unfinished checkout.
- `POST /api/bookings/:id/cancel`: cancel a booking and request/retry its full refund.
- `POST /api/payments/webhook`: signed Stripe events; no browser session needed.

Schemas, examples, errors, ownership, and headers are described in Swagger at `/api/docs`. Important payment errors include `PAYMENT_REQUIRED`, `IDEMPOTENCY_KEY_REQUIRED`, `IDEMPOTENCY_CONFLICT`, `CHECKOUT_LIMIT`, `PAYMENT_AMOUNT_UNSUPPORTED`, `PAYMENTS_NOT_CONFIGURED`, `PAYMENT_PROVIDER_UNAVAILABLE`, `PAYMENT_VERIFICATION_FAILED`, and `INVALID_WEBHOOK_SIGNATURE`.

Migration `002_checkout_payments.sql` adds checkouts, hold-aware overlap triggers, booking payment/refund fields, and a unique checkout-to-booking link. Migration `003_checkout_return_origin.sql` stores immutable return origins. Reset deletes bookings before checkouts to respect foreign keys, then restores the original practice seed. A local reset does not delete remote Stripe objects; use a separate sandbox/database for destructive experiments.

## Verification and Limits

`server/test/payments.test.ts` exercises payment rules using a controlled SDK double. Stripe's real signature validation is used for signed webhook tests. The application has no fake-payment runtime switch or unpaid booking bypass. Existing business-rule tests now go through checkout and simulated provider confirmation rather than immediate booking.

A separate temporary browser smoke test uses the actual Stripe sandbox, hosted card form, and full refund API against an isolated in-memory application database. See `verification.md` for actual results. A maintained Playwright workspace now exists in `automation/` with controlled provider scenarios; it does not automatically operate the real Stripe hosted form.

This is a local training integration. Public deployment and live payment processing are not enabled. Reconciliation runs only while the API runs; it processes up to 100 unfinished checkouts per pass. Dashboard-initiated external refunds and disputes are not a separate management workflow. Sandbox setup/availability is controlled by Stripe and account lifecycle and credential validity are managed in the owner’s Stripe Dashboard.

## Official References

- [Stripe sandboxes](https://docs.stripe.com/sandboxes)
- [Checkout Session creation and expiration](https://docs.stripe.com/api/checkout/sessions/create)
- [Checkout payment fulfillment and webhooks](https://docs.stripe.com/checkout/fulfillment)
- [Refund creation](https://docs.stripe.com/api/refunds/create)
- [Test cards](https://docs.stripe.com/testing)

## Stabilization update

Read [stabilization.md](stabilization.md) for current refresh/back/session recovery, cancellation confirmation, price locking and explicit refund behavior. Checkout responses now include serverTime, verificationPending and refundStatus. Failed full refunds without a booking can be retried with POST /api/checkouts/:id/refund. Saved checkout cancellation is retried by background reconciliation after network failure. The return origin comes from the already validated browser Origin header when present, and remains fixed for provider retries.
