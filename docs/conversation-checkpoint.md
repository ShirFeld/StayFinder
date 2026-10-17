# POM and fixture update

UI journeys now import fixtures/ui.fixture.js. All page interactions/locators live in injected Page Objects (login, catalog, stay, checkout, bookings, admin) and reusable app-shell/cancellation-dialog components. API/DB tests retain fixtures/test.js and the HTTP client. The browser provider substitute is separately managed by an on-demand fixture. See automation/README.md for the example and responsibilities.

# Current checkpoint: maintained automation workspace

October 17, 2026: The user requested and authorized an automation project. The new `automation/` npm workspace contains JavaScript Playwright API/DB suites, desktop/mobile Chromium UI journeys, isolated per-worker temporary SQLite files, clean per-test seed data, controlled Stripe/weather providers, Page Objects, observed endpoint reporting and a GitHub Actions workflow. See automation/README.md and automation/test-strategy.md for current setup and limits. Normal and manual-QA databases/credentials are preserved. Historical statements below about postponing Playwright are superseded. The workflow has not been executed on GitHub. No real Stripe network is used in the default automation run. Final local verification: 57/57 Playwright executions passed (41 API/DB plus 16 desktop/mobile UI), all 26 documented API operations exercised, all 29 Node server tests and frontend build passed.

﻿# StayFinder — Conversation checkpoint

## Latest status — Stabilization completed on October 17, 2026

The user approved all proposed pre-automation stabilization work and reported completing Stripe sandbox claim. The existing key and actual sandbox payment/refund flow were verified afterward. Do not keep telling the user that claim is still required or that the site itself expires October 24; that was the original temporary sandbox deadline. Account lifecycle is now handled in the user's Stripe Dashboard.

Completed: accessible native confirmation before first booking cancellation (Keep booking default, Escape and focus return), retained catalog destination/dates/guests/filters/sort/page, detail URL persistence, tab-local opaque idempotency tokens, owned-checkout resume, honest pending/failed/completed refund messages, server-based countdown, distinction between hold expiry and verified payment outcome, serialized status checks, browser-close/refresh recovery and expired-session sign-in return. Backend reconciliation now retries saved checkout cancellation after outage. Failed late-payment refunds without a booking have an owner-only retry endpoint. Local origin aliases and Stripe callbacks preserve the actual browser host/session.

Added guarded QA commands: npm run qa:db:reset (explicit destructive reset of QA data only), npm run qa:dev (UI 5174/API 3002), qa:status and separate migrate/seed commands. QA DB is server/data/qa/stayfinder.sqlite, cookie stayfinder.qa.sid, normal Stripe keys are never inherited. QA keys can be provided explicitly in ignored server/qa.env using server/qa.env.example. Payments are disabled by default in manual QA; deterministic Node payment tests use injected StripeDouble. No full Playwright project has been added.

All 29 Node integration test groups and the client build passed. Controlled Chrome checks passed actual browser close/reopen, refresh/back/search preservation, dialog/keyboard/focus, refund outage/retry and expired-session recovery. Real Stripe sandbox declined-card/payment/refund UI check also passed with the new dialog. QA startup/proxy/seed/cookie checks passed. English docs/stabilization.md defines the behavior contract; docs/qa-environment.md explains isolated setup. Updated architecture, requirements, payments, README and verification report. Normal database data was preserved through additive migration 004. Owned QA verification servers are stopped at handoff; any pre-existing normal development servers are left alone.

The user's original intent remains to build a JavaScript/Playwright automation framework gradually for learning and interview explanations, after this stabilization phase. Explanations to the user should be in Hebrew, with new terms explained; architecture/documentation files should be in English.

## Previous checkpoint — October 17, 2026 (takes precedence over historical notes)

The user requested and approved a payment extension: redirect to hosted Stripe Checkout, temporary date holds, and full refunds on eligible booking cancellation. The earlier no-code teaching phase is paused; implementation was explicitly authorized. Architecture documentation was requested in English and docs/architecture.md is English-only.

Implemented real Stripe sandbox integration in server/src/payments.js and client/src/checkout.jsx. New confirmed bookings require server-verified paid sessions; direct POST /api/bookings is disabled. Checkouts reserve dates for about 31 minutes. Additive migrations 002 and 003 preserve old bookings as legacy unpaid records. Signed raw-body webhooks, owner sync, startup/15-second reconciliation, payment/refund idempotency, late-payment compensation refunds, and durable refund recovery are implemented. User/availability/capacity rechecks prevent invalid finalization.

All 22 HTTP/SQLite test groups pass. Actual isolated Chrome UI testing against the real Stripe sandbox passed hosted redirect, declined card without a booking, successful card payment, paid booking confirmation, and full refund through cancellation. Webhook completion/refund delivery returned 200. Build passed. Details are in docs/payments.md and docs/verification.md.

User confirmed the sandbox email directly in chat. A temporary sandbox was provisioned and expires October 24, 2026 unless claimed. Credentials are only in ignored server/.env and server/data; do not print them. The private claim link is in ignored server/data/stripe/stripe-sandbox-access.md. The user should run npm run payments:listen in one terminal and npm run dev in another. For built UI on port 3001 set CHECKOUT_ORIGIN accordingly before creating new checkouts. Test card: 4242 4242 4242 4242; future expiry and any three-digit CVC. Sandbox only; live keys are rejected.

## Historical conversation context

Updated: 2026-10-13 (Asia/Jerusalem).

## User and project context

The user is a QA Automation Engineer using JavaScript and Playwright. StayFinder is a local vacation booking full-stack demo for practicing UI, API and SQL testing and explaining a portfolio project in interviews.

Stack: React + Vite JavaScript frontend (client), Node.js + Express JavaScript backend (server), SQLite with migrations and deterministic seed; OpenAPI + Swagger UI; documentation in docs. English responsive UI. Session authentication via HttpOnly cookies and bcrypt passwords. No payment/email/full Playwright infrastructure requested yet.

## Implementation status

Implemented catalog/search/date availability/capacity/price/amenity filters/sort/pagination, detail page, login/logout, booking price quote and confirmation, My Bookings and cancellation, admin accommodation create/edit/deactivate, user creation/role/status management, all-bookings view, and server-proxied Open-Meteo weather with configurable URL and timeout.

Business rules include no past check-in, checkout later than check-in, positive guests within capacity, server-calculated USD cents, stored booking price snapshot, atomic overlap prevention with SQLite immediate transactions and triggers, exclusive checkout, cancellation before check-in, idempotent cancellation, ownership enforcement, unique case-insensitive emails, and preserved bookings for inactive properties.

Verification: npm run build and five Node HTTP/SQLite integration test groups passed. Temporary ignored headless Edge/CDP smoke checks passed desktop/mobile and real UI login, availability, booking, cancellation, logout and admin edit/users/bookings. Live weather returned HTTP 200. npm run dev and Vite proxy were checked. Tests use isolated in-memory databases; normal practice DB contains three users and twelve units. Owned verification servers were stopped. See docs/verification.md for coverage limits.

Demo accounts: admin@stayfinder.demo, jamie@stayfinder.demo, taylor@stayfinder.demo. Shared demo password: StayFinder123!. Local dev command from project root: npm run dev. Frontend http://localhost:5173; API http://localhost:3001; Swagger /api/docs. README documents setup, reset and configuration.

## Current user instruction — explanation phase, no code changes

The user explicitly asked: do not change code now. Explain in Hebrew, gradually, using examples from the actual project. Define unfamiliar terms and do not assume the user understands generated code. Requested teaching sequence:

1. General structure: frontend, backend, database.
2. How each part starts and how they communicate.
3. Trace Login from UI click to endpoint, database check, response and saved session.
4. Then trace booking creation similarly.
5. Show API documentation, seed and business rules.

The user requested ONLY the general structure first, then stop for questions. That step was delivered. Do not jump ahead to Login or booking or resume implementation. Answer any questions on structure; if the user asks to continue the explanation, next is startup and communication.

## Last explanation delivered

Explained client/server/docs/package.json/README layout and the three parts:

- Frontend runs in browser; React components describe UI. main.jsx contains Home, Catalog, Detail, Login and Bookings; admin.jsx has admin screens; shared.jsx handles fetch/loading/error/photo helpers; styles.css controls visual/responsive design. Defined React component and JSX.
- Backend runs in Node.js using Express; index.js starts server, app.js handles requests/authorization/business rules, database.js connects/migrates/seeds, config.js holds settings, session-store.js persists login sessions.
- SQLite is a file database, default server/data/stayfinder.sqlite. Defined rows/columns and tables: users, properties, bookings, sessions, migrations. Explained password hashing as verification without recovering the original password. Follow-up should distinguish hashing from encryption explicitly if relevant.
- Used SQL fields user_id REFERENCES users(id) and property_id REFERENCES properties(id) to explain IDs and relationships: booking connects user 2 with property 1 without copying all their details.
- High-level flow: browser UI ↔ server ↔ database; catalog requests properties, server reads database and UI displays cards; browser never directly opens SQLite.

Stopped at the user's requested point, inviting questions about structure.

## Persistence request

The user then asked in Hebrew: "Save the conversation so you remember it and we will continue from this point." This file is the durable project checkpoint, not a claim of guaranteed automatic cross-conversation memory. Read it when resuming. The user can reference docs/conversation-checkpoint.md in a new conversation.
