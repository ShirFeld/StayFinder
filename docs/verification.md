# Verification report

Checked locally on Windows with Node 22.12.0 and npm 10.9.0.

| Stage                                 | Verification                                                                                                                                                                   | Result |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| 1 — infrastructure, login and catalog | Production build; real HTTP session/login/logout, seed count, filters, sorting, pagination, validation                                                                         | Passed |
| 2 — bookings                          | Competing HTTP requests produce exactly one 201 and one 409; server total; SQL snapshot; adjacent stays; owner access; cancel/repeat/cutoff                                    | Passed |
| 3 — admin and weather                 | Property create/edit/deactivate; preserved booking; users/unique email/roles/session revocation; controlled weather success, bad schema, HTTP failure and timeout              | Passed |
| 4 — UI and responsive presentation    | Headless Edge at desktop 1440 and mobile 390; actual form login, availability, confirm booking, My Bookings, cancellation, logout, Admin listing edit, users and booking table | Passed |

Original baseline: five Node integration test groups passed (`npm test`), using in-memory SQLite and a real listening HTTP server. Bundling passed (`npm run build`). Development startup passed (`npm run dev`): UI 5173, API 3001; Vite proxy /api/health returned ok and catalog returned 12 seed units. Real Open-Meteo request through /api/weather returned HTTP 200 with normalized current temperature and wind.

Browser smoke checks used a temporary standalone Chrome DevTools Protocol script under ignored test-results/, not a new Playwright infrastructure. No JavaScript exceptions or horizontal page overflow on checked pages. Screenshots were inspected for desktop/mobile home; all core demo photos are bundled locally, and the Lake Como destination uses an actual Lake Como photograph. Same-origin authentication was tested against the built Express-served client with the standard APP_ORIGIN setting.

Coverage limits: this is focused local smoke/integration verification, not exhaustive cross-browser, load, accessibility audit or security testing. Competing requests were checked in one application process; immediate transactions and SQL overlap triggers provide database-level protection, but a multi-process stress test was not run. Upstream weather can change or be unavailable after this check. At that baseline, payment/email/full Playwright infrastructure were out of scope; the sandbox payment extension below supersedes the payment limitation.

No test bookings were added to the practice database: automated API/UI checks used isolated in-memory databases. The live weather check and development readiness checks read the seeded practice database.

## Stripe Sandbox Extension — October 17, 2026

- All 22 Node HTTP/SQLite test groups pass, including the original five adapted to checkout. Payment-specific coverage includes atomic holds, duplicate fulfillment, checkout/refund idempotency, signed webhook replay and rejection, expiry/late-payment refunds, owner access, cancellation/payment races, provider outages, refund states/retries, immutable callback origins, disabled users, reduced capacity, legacy bookings, SQL hold protection, and missing credentials.
- Production bundling succeeds with the checkout return/recovery page and Admin payment status.
- An actual Chrome browser test uses the real Stripe sandbox, not a local payment imitation. It signs in, selects dates, redirects to hosted Stripe Checkout, submits a declined test card (no booking created), retries with a successful test card, verifies a confirmed $330.00 booking, and cancels through My Bookings. Stripe confirms a full test refund.
- The live webhook listener delivered checkout completion and refund updates to the isolated test server; both returned HTTP 200.
- Desktop confirmation and mobile paid/refunded booking screenshots were inspected. The mobile booking page has no horizontal page overflow.
- Browser tests use a separate in-memory application database and dedicated port 3011; no test reservations were inserted into the practice database. Remote Stripe sandbox payment/refund objects remain as test records. Existing practice data is preserved by additive migrations.
- No full Playwright framework was added. A 3-D Secure challenge, multi-process load test, public deployment, real payments and externally initiated dispute/refund management remain outside this verification. The temporary sandbox expires October 24, 2026 unless claimed.

## Stabilization Pass — October 17, 2026 (Current)

This section supersedes the original temporary-sandbox deadline and earlier verification counts where applicable.

- The owner reported completing Stripe sandbox claim. The existing sandbox key was verified afterward; a real hosted Checkout browser run passed declined card, successful card payment, confirmation, the new cancellation dialog, and full refund. Account lifecycle remains managed in the owner's Dashboard.
- All **29 Node HTTP/SQLite test groups** pass. New cases cover saved cancellation recovery after outage, explicit failed-refund retry without a booking, locally expired/unverified payment state, accepted local origins/rejected foreign origins, immutable browser return origin, and QA reset/credential isolation.
- Production build and additive migration checks pass. Migration 004 preserves existing data and adds explicit refund recovery state.
- Controlled Chrome browser checks passed search/filter/sort/page preservation, route heading focus, refresh, actual browser close/reopen with the same hold, detail-page resume, delayed provider confirmation, exactly one booking, native cancellation dialog, default Keep booking focus, Tab, Escape, focus restoration, pending refund feedback and retry, expired-session reauthentication to the original checkout, and skip-to-main navigation.
- Desktop checkout status and mobile dialog/refund screenshots were inspected. No JavaScript exceptions or horizontal page overflow occurred in the checked mobile flows.
- QA development startup was checked on ports 5174/3002. Vite proxy, 12 seeded units, HttpOnly `stayfinder.qa.sid`, and matching Swagger cookie metadata passed real HTTP checks. Only the QA database was explicitly reset; normal application data was not reset.
- Temporary controlled-browser scripts remain under ignored test-results, separate from a future Playwright learning project. The checked-in Node integration tests use injected controlled provider behavior and isolated memory databases.

Limits: this remains a targeted desktop/mobile and keyboard pass, not exhaustive WCAG/screen-reader/cross-browser/load verification. QA payments are disabled by default unless QA-specific sandbox credentials are intentionally configured. No full Playwright framework was introduced.
