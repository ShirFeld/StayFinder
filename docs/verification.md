# Verification report

Checked locally on Windows with Node 22.12.0 and npm 10.9.0.

| Stage                                 | Verification                                                                                                                                                                   | Result |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| 1 — infrastructure, login and catalog | Production build; real HTTP session/login/logout, seed count, filters, sorting, pagination, validation                                                                         | Passed |
| 2 — bookings                          | Competing HTTP requests produce exactly one 201 and one 409; server total; SQL snapshot; adjacent stays; owner access; cancel/repeat/cutoff                                    | Passed |
| 3 — admin and weather                 | Property create/edit/deactivate; preserved booking; users/unique email/roles/session revocation; controlled weather success, bad schema, HTTP failure and timeout              | Passed |
| 4 — UI and responsive presentation    | Headless Edge at desktop 1440 and mobile 390; actual form login, availability, confirm booking, My Bookings, cancellation, logout, Admin listing edit, users and booking table | Passed |

Five Node integration test groups passed (`npm test`), using in-memory SQLite and a real listening HTTP server. Bundling passed (`npm run build`). Development startup passed (`npm run dev`): UI 5173, API 3001; Vite proxy /api/health returned ok and catalog returned 12 seed units. Real Open-Meteo request through /api/weather returned HTTP 200 with normalized current temperature and wind.

Browser smoke checks used a temporary standalone Chrome DevTools Protocol script under ignored test-results/, not a new Playwright infrastructure. No JavaScript exceptions or horizontal page overflow on checked pages. Screenshots were inspected for desktop/mobile home; all core demo photos are bundled locally, and the Lake Como destination uses an actual Lake Como photograph. Same-origin authentication was tested against the built Express-served client with the standard APP_ORIGIN setting.

Coverage limits: this is focused local smoke/integration verification, not exhaustive cross-browser, load, accessibility audit or security testing. Competing requests were checked in one application process; immediate transactions and SQL overlap triggers provide database-level protection, but a multi-process stress test was not run. Upstream weather can change or be unavailable after this check. Payment/email/full Playwright infrastructure remain deliberately out of scope.

No test bookings were added to the practice database: automated API/UI checks used isolated in-memory databases. The live weather check and development readiness checks read the seeded practice database.
