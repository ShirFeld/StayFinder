# QA Environment Before Automation

This setup prepares isolated data and predictable checks without introducing a Playwright project yet.

## Two Local Environments

| Setting                  | Normal practice environment     | Isolated QA environment                              |
| ------------------------ | ------------------------------- | ---------------------------------------------------- |
| Frontend                 | http://localhost:5173           | http://localhost:5174                                |
| API                      | http://localhost:3001           | http://localhost:3002                                |
| Default SQLite file      | `server/data/stayfinder.sqlite` | `server/data/qa/stayfinder.sqlite`                   |
| Session cookie           | `stayfinder.sid`                | `stayfinder.qa.sid`                                  |
| Stripe credentials       | `server/.env`                   | Explicit `QA_STRIPE_*` values only                   |
| Default weather provider | Open-Meteo                      | Local stub URL; unavailable unless a stub is running |

Cookies are scoped by host rather than port. A different QA cookie name prevents signing in or out in QA from replacing the normal environment's session. Both localhost and 127.0.0.1 are supported for the configured local frontend port. A new checkout saves the trusted browser origin so Stripe returns to the same host and session.

## Start QA

Run from the project root:

```powershell
# Explicit destructive reset of QA data only; do this when a clean dataset is needed.
npm run qa:db:reset

# Starts the separate API and Vite frontend.
npm run qa:dev
```

Open http://localhost:5174. Swagger: http://localhost:3002/api/docs. The seed is the same deterministic set of three users and twelve units described in README. There are initially no bookings or checkouts.

`npm run qa:status` prints the resolved database, ports, cookie name, provider mode, and record counts. It never prints secrets. `qa:db:migrate` and `qa:db:seed` are also available separately. Startup applies migrations but never resets or seeds automatically. `qa:api` and `qa:client` run each side individually.

The reset command refuses a database outside `server/data/qa`, a directory instead of a SQLite file, or a path redirected through a junction/symbolic link. The lower-level script requires `reset --confirm`; the named npm reset command supplies that explicit confirmation. No normal database is reset by these commands.

## Optional QA Configuration

```powershell
Copy-Item server/qa.env.example server/qa.env
```

`server/qa.env` is ignored by Git. Example settings:

```dotenv
QA_DB_PATH=./data/qa/stayfinder.sqlite
QA_TIMEZONE=Asia/Jerusalem
QA_STRIPE_SECRET_KEY=
QA_STRIPE_WEBHOOK_SECRET=
QA_WEATHER_BASE_URL=http://127.0.0.1:3999/weather
QA_WEATHER_TIMEOUT_MS=1000
```

The QA launcher does not inherit normal Stripe credentials. Without explicit QA credentials, opening payment returns `PAYMENTS_NOT_CONFIGURED`, rather than issuing unexpected provider requests. An absent weather stub shows the expected weather-unavailable state and does not affect browsing or booking business rules.

To manually exercise real Stripe from QA later, use a dedicated Stripe sandbox and configure QA-specific keys and webhook delivery to port 3002. Do not use the normal listener, which targets the normal API, as a QA webhook setup. The regular app's real Stripe flow remains available on port 5173.

## Controlled Tests Already Available

```powershell
npm test
```

These Node integration tests use in-memory SQLite, actual listening HTTP servers, and an injected provider double in `server/test/stripe-double.ts`. It controls payment success, unpaid sessions, expiry, network errors, refunds, and idempotency. Real Stripe signature validation is used in webhook tests. Weather success/error/timeout cases use a local HTTP stub. These checks do not require Stripe availability or alter the normal or QA file databases.

The provider double is test-only; the application has no environment setting that marks an arbitrary checkout as paid. The Playwright harness in `automation/` intercepts the external hosted browser page and injects the provider double at the existing app factory boundary. A small separate set of real-sandbox checks can then verify the actual Stripe integration.

## Suggested Automation Layers

1. UI behavior: accessible names, search/navigation, native cancellation dialog, session recovery, and payment-state presentation.
2. API business rules: permissions, dates, capacities, held availability, idempotency, cancellation, and refund recovery.
3. SQL assertions: stored price snapshots, foreign keys, no overlapping confirmed bookings/active holds, and one booking per checkout.
4. External integration smoke checks: a limited set against Stripe sandbox and Open-Meteo, kept separate from deterministic checks.

This is preparation and a behavior contract, not a full Playwright infrastructure. See [the stabilization contract](stabilization.md) before writing scenarios.

## Automated versus manual QA

The maintained Playwright project is now in `automation/`. It does not target or reset this manual QA environment. Each worker owns a disposable SQLite database in an OS temporary directory and each test starts a real API on an automatically assigned loopback port. Payment and weather providers are controlled without inheriting secrets. See [the automation guide](../automation/README.md).
