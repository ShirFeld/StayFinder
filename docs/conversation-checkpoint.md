# StayFinder — Conversation checkpoint

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
