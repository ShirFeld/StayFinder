# StayFinder

A local full-stack vacation accommodation booking demo for learning UI, API and SQL testing. React + Vite (JavaScript), Express (JavaScript), SQLite, session cookies and Swagger UI. All listings and accounts are fictional practice data; stock photographs illustrate a style of accommodation and are not photographs of real bookable properties. No reviews are fabricated or displayed.

## Sandbox payment checkout

The current booking flow requires payment verification: sign in, choose dates, continue to hosted Stripe Checkout, and pay with a test card. Dates are held for approximately 31 minutes. A confirmed booking is created only after server verification. Cancelling an eligible paid booking requests a full sandbox refund; pending/failed refunds are shown honestly and retried safely.

Start the local event listener with `npm run payments:listen` in one terminal, then `npm run dev` in another. The current checkout already has sandbox credentials in ignored `server/.env`. The owner reported claiming the sandbox on October 17, 2026, and the existing credential was verified successfully. Account lifecycle is managed in Stripe Dashboard; private setup information remains in ignored `server/data/stripe/stripe-sandbox-access.md`. Read [the payment setup and test guide](docs/payments.md) for test cards, callback settings, recovery, and fresh-clone configuration.

Use `4242 4242 4242 4242`, a future expiry date, and any three-digit CVC for a successful sandbox payment. Never enter real card details. No real money moves.

## Stabilization and isolated QA

The current flow includes cancellation confirmation, retained search filters/page, checkout recovery after refresh/browser close/session expiry, and separate pending/failed/completed refund messages. See [the behavior contract](docs/stabilization.md).

For isolated local practice, run `npm run qa:db:reset` explicitly, then `npm run qa:dev`. QA uses UI port 5174, API port 3002, a separate database and cookie, and no inherited payment credentials. `npm run qa:status` shows its configuration and data counts. Controlled payment tests remain available through `npm test`; no full Playwright framework has been added. Read [the QA setup guide](docs/qa-environment.md) before automating.

## Requirements and Windows setup

Node.js 22 LTS and npm, VS Code, Windows PowerShell. SQLite is bundled through better-sqlite3; no separate database service is needed. A supported Node version matters because better-sqlite3 is a native dependency. Run commands from the project root:

```powershell
npm install
Copy-Item server/.env.example server/.env
npm run db:migrate
npm run db:seed
npm run dev
```

Open http://localhost:5173. API: http://localhost:3001/api/health. Swagger: http://localhost:3001/api/docs (also /api/docs through Vite). OpenAPI JSON: /api/openapi.json. Keep the terminal running; Ctrl+C stops development servers. Migrations run on API startup; seeding and reset NEVER run automatically. Existing nonempty databases must not be seeded again.

The database was initialized during project setup, so on this prepared checkout you can start with `npm run dev`. For a fresh clone use the complete setup above.

## Demo accounts

| Role     | Email                  | Password       |
| -------- | ---------------------- | -------------- |
| Admin    | admin@stayfinder.demo  | StayFinder123! |
| Customer | jamie@stayfinder.demo  | StayFinder123! |
| Customer | taylor@stayfinder.demo | StayFinder123! |

12 entire accommodation units across Lisbon, Santorini, Bali and Lake Como. Seed IDs and values are deterministic. There are no initial bookings. Prices are USD, stored as integer cents. Never use these accounts or the default session secret in a public production deployment.

## Commands

| Command            | Purpose                                                     |
| ------------------ | ----------------------------------------------------------- |
| npm run dev        | API watch mode and Vite together                            |
| npm run build      | Build client/dist                                           |
| npm start          | Serve API and built client at http://localhost:3001         |
| npm test           | HTTP integration checks on isolated in-memory SQLite        |
| npm run db:migrate | Apply unapplied versioned SQL migrations                    |
| npm run db:seed    | Seed an empty practice database                             |
| npm run db:reset   | Explicitly delete practice business/session data and reseed |

Reset is destructive for the configured DB_PATH. It preserves migration history, clears sessions, and restores the three users and twelve units. It is intended only for this practice database. The lower-level command requires confirmation: `npm run db:reset -w server -- --confirm`.

For another database set DB_PATH in server/.env, e.g. `./data/practice-test.sqlite`. Relative paths resolve from server/. The API tests force `:memory:` before importing the app; they cannot overwrite your normal data. For an external UI test database, migrate and seed that separate DB_PATH and run a dedicated API instance. See docs/requirements.md for expected behavior and docs/sql-practice.sql for read-only SQL examples.

## Environment

Use server/.env.example. Workspace npm commands run server with server/ as the working directory, so dotenv loads server/.env. PORT defaults to 3001; the Vite proxy targets that port. If you change PORT, update client/vite.config.js. APP_ORIGIN is the browser origin used for mutation origin checks. APP_TIMEZONE controls the business date (default Asia/Jerusalem), not the browser clock. SESSION_SECRET secures the cookie session signature; session records live in SQLite. The production mode requires a secret of at least 32 characters and HTTPS because its cookie is Secure; the supplied npm start command is a local preview, not an internet deployment recipe.

## Weather provider

Open-Meteo was selected because it offers a documented JSON forecast endpoint without an API key for non-commercial demonstrations. This project uses its current model-derived weather for each seeded unit's coordinates, not a forecast for the selected travel dates. The free hosted API is for non-commercial use, has usage limits, and no uptime guarantee. Data requires attribution under CC BY 4.0; the weather panel links to Open-Meteo. Official references: https://open-meteo.com/en/docs, https://open-meteo.com/en/terms, https://open-meteo.com/en/pricing. A commercial deployment needs a suitable provider plan.

The browser calls /api/weather?propertyId=1. Only the server calls the upstream URL. WEATHER_BASE_URL can point to a local controlled HTTP stub. It receives latitude, longitude, current=temperature_2m,weather_code,wind_speed_10m, timezone=auto and explicit Celsius/km/h units. A success stub returns:

```json
{
  "current": {
    "temperature_2m": 23,
    "weather_code": 0,
    "wind_speed_10m": 7,
    "time": "2030-06-10T12:00"
  }
}
```

Non-2xx HTTP, malformed JSON/schema, network errors or timeout return 503 WEATHER_UNAVAILABLE. The booking process remains available. WEATHER_TIMEOUT_MS defaults to 4000. The URL is trusted server configuration, never user-controlled input.

## Structure and request flow

- client/src/main.jsx: routes, home, search, detail, login and bookings.
- client/src/admin.jsx: accommodation, user and booking administration.
- client/src/checkout.jsx: hosted-payment return, verification and hold recovery.
- client/src/shared.jsx: fetch wrapper, async state and image fallback.
- client/src/styles.css: desktop and mobile presentation.
- server/src/app.js: API validation, authorization and business operations.
- server/src/payments.js: Stripe Checkout, holds, verification, cancellation and refunds.
- server/scripts/stripe-listen.js: local webhook forwarding.
- server/src/database.js and server/migrations/: connection, migrations and explicit seed/reset.
- server/src/session-store.js: durable SQLite session store.
- server/src/openapi.js: API contract rendered by Swagger UI.
- server/test/api.test.js: Node HTTP integration checks, not a Playwright project.
- docs/: requirements, architecture and SQL practice.

UI form → same-origin /api fetch (Vite proxy in development) → Express session and role checks → input/business validation → SQLite query or immediate transaction → JSON → UI loading, success or error state. Checkout creation atomically checks availability and snapshots the server price in a temporary hold. Verified Stripe payment creates the booking in a separate immediate transaction. SQLite triggers also reject overlaps; cancellation changes status rather than deleting history. Money is not recalculated when listing prices change.

## Scope and limitations

Local training application: no live payments, email, public registration, password reset, file uploads, reviews, or full Playwright automation project. Admin users can create accounts and change roles/status; profile editing and password rotation are not implemented. Core sample photos are bundled locally (see docs/image-credits.md); admin-added photos and fonts use external services with local image/system font fallbacks. Stock photos may differ from the fictional destination. Weather has no cache and no service guarantee. Admin tables are unpaginated, suitable for this small demo. Sessions expire after one day; expired records are ignored, but background database cleanup is not implemented. Production deployment, monitoring and an advanced CSRF token flow are outside this local demo; same-site cookies and mutation Origin checks are present.

## Verification

`npm test` exercises a real listening Express server: seed counts, filtering, sort, pagination, authentication/logout/HttpOnly cookie, role boundaries, invalid dates and guests, competing requests, adjacent bookings, price snapshots, cancellation ownership/idempotency/cutoff, property CRUD/deactivation, unique emails, self-lockout, disabled sessions, provider success/error/timeout, OpenAPI and SQL overlap triggers. `npm run build` verifies production bundling. UI checks and their results are documented in docs/verification.md.

## Documentation

See the [documentation guide](docs/README.md) for architecture, requirements, QA setup, payments and verification.
