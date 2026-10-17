# StayFinder expected behavior

## Identity and permissions

Anonymous visitors can browse destinations, active units, availability, and weather. Login regenerates the session and sets an HttpOnly SameSite=Lax cookie; logout destroys it. Passwords are bcrypt hashes. Customer booking queries are always scoped to the current user. Another customer's cancellation returns 404. Admin APIs require an active administrator; anonymous gets 401, customer gets 403. Disabling a user revokes access on their next request. Administrators cannot disable or demote themselves. Emails are unique case-insensitively. User creation requires a valid email and a password of at least ten characters.

## Catalog

Each row represents exactly one entire accommodation unit. Only active units appear publicly. Destination is a case-insensitive substring search. Guests filter capacity. Price boundaries are inclusive USD cents. All selected amenities must be present. Supported sort orders: recommended (ID), price ascending/descending, name; stable ID tie breaker. Default page size 6, maximum 50. Empty search has zero items and zero totalPages. Both dates must be supplied together. Invalid query input returns 400, never silently changes the search.

## Booking

Dates are real YYYY-MM-DD calendar dates. Check-in cannot precede the server's business date in APP_TIMEZONE. Check-out must be later; maximum stay 365 nights. Guests are integers from 1 to unit capacity (maximum configured capacity 50). Price and total are calculated server-side; total = nights × nightly price in cents, USD with no fees. Snapshot fields persist even if the listing is edited. An availability quote does not hold a reservation.

Confirmed intervals overlap only when existing.check_in < requested.check_out AND existing.check_out > requested.check_in. Checkout is exclusive. Atomic immediate SQLite transactions and database triggers prevent competing bookings. Unavailable dates return 409 BOOKING_CONFLICT. Deactivation prevents new bookings and hides the listing but preserves existing bookings/history.

## Cancellation

Only the owner can cancel. Confirmed bookings can be cancelled strictly before the check-in business day. On or after that day returns 409 CANCELLATION_CLOSED. Cancellation records a timestamp, preserves prices/history and releases availability. Repeated cancellation returns the existing cancelled booking and does not change its timestamp, including after check-in.

## Admin

Create and full-update accommodation with name, destination, description, positive integer price in cents, capacity 1–50, supported amenities, 1–8 HTTPS image URLs, latitude -90..90, longitude -180..180, and active boolean. Unsupported input returns 400. Admins view all users and bookings, create accounts, and change user role/status. Inactive units remain visible in Admin.

## Weather and errors

Weather is independent from booking availability. Upstream success is normalized; timeout, HTTP error, malformed data or network failure produces 503 WEATHER_UNAVAILABLE and an informative UI message. Stub URL and timeout are environment configuration. All API errors use {error:{code,message}}. Important codes: INVALID_CREDENTIALS, UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, VALIDATION_ERROR, PAST_DATE, INVALID_DATES, BOOKING_CONFLICT, CANCELLATION_CLOSED, EMAIL_EXISTS, SELF_LOCKOUT, WEATHER_UNAVAILABLE. Swagger provides request/response schemas and access requirements.

## UI states and accessibility

English responsive layout; semantic navigation, headings, forms, labels, table headers and buttons. Focus indicators are visible. Async pages show loading, actionable errors/retry or empty guidance. Submission buttons disable while pending. Booking confirmation shows its ID and authoritative price. My Bookings displays confirmed/cancelled status and original pricing. Photo errors show a local SVG. Stock images and fictional data are documented; no fabricated customer reviews. Use semantic Playwright locators when the future automation project is added.

## Payment checkout update

New bookings require hosted Stripe sandbox payment. An availability quote does not hold dates; starting checkout creates a temporary hold and snapshots server prices. Confirmed bookings and unexpired checkout holds both block overlapping intervals. The server creates the booking only after verifying a paid Stripe session. Direct POST /api/bookings returns 409 PAYMENT_REQUIRED. First cancellation before check-in requests a full refund, with separate pending/failed/refunded states. Existing bookings are preserved as legacy unpaid records. See [payments.md](payments.md) for the full current behavior, retry/expiry rules, test cards and provider setup.
