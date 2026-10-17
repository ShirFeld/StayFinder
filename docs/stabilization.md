# Stabilization and Behavior Contract

Updated: October 17, 2026. These decisions describe the current application and can be used to derive future manual and automated scenarios.

## Price, Availability, and Payment

| Stage                                | Expected behavior                                                                                        | Persistent data                                         |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Availability quote                   | Checks current availability and price; does not reserve dates                                            | No new checkout or booking                              |
| Continue to payment                  | Revalidates availability and snapshots the current price; holds dates for approximately 31 minutes       | One checkout; no booking                                |
| Unpaid or declined card              | No confirmed booking; the same checkout can be retried until expiry/cancellation                         | Active checkout hold                                    |
| Paid and verified                    | Server verifies Stripe session identity, metadata, currency, amount and sandbox mode                     | Exactly one confirmed, paid booking                     |
| Hold ended; verification pending     | Dates are no longer blocked by that hold, but the UI does not claim payment failed or a refund completed | Existing checkout awaiting authoritative provider state |
| Paid too late or after cancellation  | Never displaces another reservation; full refund is requested                                            | No new booking; explicit refund state                   |
| Cancellation requested during outage | Intent is saved; still-payable dates are not released prematurely; reconciliation retries session expiry | Durable cancellation intent                             |

The quote is indicative until checkout starts. A listing price change before starting a hold can change the checkout amount shown by Stripe. Changes after the hold starts do not change that checkout's price snapshot. Dates are evaluated in APP_TIMEZONE, not by the user's device clock. The hold countdown uses server time to reduce device-clock errors; the countdown never authorizes a booking by itself.

## Refresh, Back, Close, and Retry

- Refreshing a checkout retrieves its existing server record and verifies provider state. It does not create another checkout or booking.
- Closing the browser does not delete the hold. Opening the same checkout, or signing in and visiting My Bookings, recovers it while it remains relevant.
- Returning to the accommodation with the same dates offers Resume your checkout when an owned active checkout exists.
- The browser tab stores only an opaque idempotency token for retrying a selected stay. Authoritative dates, amounts and statuses remain in SQLite. Business data is not stored in localStorage.
- A failed/terminal checkout clears its retry token when viewed, so a deliberate new attempt can use a new token.
- If the session expires, the app clears its stale signed-in UI. Sign-in links preserve the checkout URL and return to it after authentication.
- A browser success query parameter is not evidence of payment. Delayed confirmation is described as awaiting verification.
- Stripe's cancellation return is consumed after a successful cancellation response. Reloading the result does not continuously repeat the initial browser action.
- Automatic polls and user-triggered status checks are serialized per mounted checkout page. In-flight results from a previous page do not overwrite the current checkout.
- Checkout status is refreshed when the window regains focus, so browser back/return can recover recent changes.

## Cancellation Confirmation

The first cancellation opens a native modal dialog with the accommodation, dates, guests, full test refund amount (or legacy no-payment explanation), and the fact that released dates cannot be restored by undo.

Keep booking receives initial focus. Keep booking and Escape dismiss the dialog without changing the booking. Tab navigation stays inside the native modal; closing it restores focus to the initiating control. During an in-flight cancellation, duplicate submission and dismissal are disabled. A server error is shown inside the dialog so the user can retry or keep the booking.

The first cancellation must occur before check-in day. Repeating an already recorded cancellation preserves its timestamp. Refund recovery can continue after check-in when the original cancellation met the cutoff.

## Refund Status

Cancellation and refund are separate facts. Cancellation releases dates; it does not imply a completed refund.

| State                                        | User-facing meaning                                    |
| -------------------------------------------- | ------------------------------------------------------ |
| `paid`                                       | Payment verified; booking confirmed                    |
| `refund_pending` / checkout refund `pending` | Full refund requested; awaiting provider confirmation  |
| `refund_failed` / checkout refund `failed`   | Provider reported failure; explicit retry is available |
| `refunded` / checkout refund `succeeded`     | Provider confirmed the full refund                     |
| `legacy`                                     | Older booking with no Stripe payment                   |

A failed late-payment refund can be retried from its checkout even when there is no booking. The endpoint is owner-only and idempotent for completed refunds. A known failed attempt gets a new refund idempotency key; a pending/uncertain attempt reuses the existing key. Background reconciliation recovers saved cancellation/refund intent after a provider outage or API restart.

## Search and Navigation

The catalog query string carries destination, dates, guests, price bounds, amenities, sort, page and page size. Accommodation links keep that query string. All stays returns to those results instead of clearing the search. Date/guest changes in the detail screen update its URL, so refresh and login return preserve the selected stay. Editing prices in filters uses decimal dollars and rounds to integer cents before sending the API query.

## Accessibility and Feedback

A skip link targets the main content. Main navigation has an accessible name. Route changes move focus to the page heading and update the document title; changing a catalog filter does not refocus the whole page. Search counts and payment-state changes have polite status announcements. The countdown is not announced every second. Forms retain labels, buttons have meaningful names, error messages use alerts, and reduced-motion preferences disable decorative motion.

Desktop and mobile checks cover the core search, payment recovery, cancellation, refund, keyboard and login flow. This is a focused accessibility pass, not a claim of complete WCAG compliance or a screen-reader audit.

## Stripe Account Status

The owner reported completing sandbox claim on October 17, 2026. The configured sandbox credential was then verified by creating and expiring a real hosted Checkout session. A real-sandbox browser smoke test additionally checks declined card, successful payment and full refund. Account ownership/lifecycle should be managed in the owner's Stripe Dashboard; no password or secret is needed in chat.

## QA Isolation

Use the separate ports, database and cookie described in [qa-environment.md](qa-environment.md). Controlled Node integration tests exercise provider failures without relying on Stripe availability. No full Playwright project was added in this stabilization pass.
