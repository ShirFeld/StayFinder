# StayFinder automation

JavaScript + Playwright Test, covering the real React UI, Express API and SQLite database. No running development server, Stripe account or secret key is required.

## Quick start (Windows / VS Code)

From the repository root, install Node.js 22 LTS, then run:

```powershell
npm ci
npm run browsers:install -w automation
npm run test:sanity
npm run test:automation
npm run test:report
```

The first command installs all three npm workspaces. Browser installation is only needed after a fresh setup or a Playwright upgrade. Each test run builds the frontend automatically. You do not need `npm run dev` or `npm run qa:dev`.

| Root command              | Purpose                                                         |
| ------------------------- | --------------------------------------------------------------- |
| `npm run test:automation` | Entire Playwright suite: API, SQL, desktop UI and mobile UI.    |
| `npm run test:sanity`     | Small set of critical scenarios tagged `@sanity`.               |
| `npm run test:api`        | API and DB suites, without launching a browser.                 |
| `npm run test:ui`         | UI journeys on desktop Chromium and Pixel 7 Chromium emulation. |
| `npm run test:payments`   | Tests tagged `@payments`, including payment UI journeys.        |
| `npm run test:db`         | Tests tagged `@db`, including API flows with SQL assertions.    |
| `npm run test:report`     | Open the latest HTML report.                                    |
| `npm test`                | Existing lower-level server regression suite in `server/test`.  |

For interactive debugging:

```powershell
npm run test:headed -w automation
npm run test:debug -w automation
```

To run one test by its case ID:

```powershell
npm exec -w automation --call "playwright test --project=api --grep PAY-06"
```

## Structure

```text
automation/
|-- api/client.js                  HTTP helper with explicit expected status
|-- data/builders.js               Demo accounts and relative-date input builders
|-- data/endpoints.json            All documented operations mapped to test cases
|-- fixtures/test.js               Isolated database, real app, sessions and providers
|-- fixtures/ui.fixture.js         Injected Page Objects and browser-only fixtures
|-- pages/                         UI Page Objects plus shared shell/dialog components
|-- support/build-client.js        Build the UI once before a run
|-- support/endpoint-reporter.js   Observe actual HTTP operations and status codes
|-- tests/api/                     Sanity, catalog, auth, admin, payments and weather
|-- tests/db/                      SQL integrity, constraints and persisted behavior
|-- tests/ui/                      Desktop and mobile browser journeys
|-- playwright.config.js           Projects, timeouts, retries and reporting
|-- reports/                       Generated HTML, JUnit, JSON and endpoint reports
|-- test-results/                  Generated traces, screenshots and videos on failure
```

Reports and failure artifacts are ignored by Git. The CI workflow is in `../.github/workflows/automation.yml`.

## How isolation works

1. Each Playwright worker creates its own unique `stayfinder-automation-*` directory in the operating system temporary folder.
2. Before importing application modules, the fixture explicitly selects that directory's SQLite file and overrides the application environment, including Stripe credentials and dotenv configuration.
3. Before each test, the fixture resets only this worker's database and seeds the three demo users and twelve accommodation units. Migrations run against this database.
4. Each test starts the actual Express application and weather substitute on unused operating-system-assigned loopback ports. Express serves the built React frontend, so UI and API use the same origin.
5. Customers and administrators have separate HTTP request contexts and session cookies. Browser contexts are also fresh for each test.
6. Servers are closed after the test; the worker closes SQLite and removes only its own temporary directory at teardown.

This is a disposable automated test environment. The manual QA environment on ports 5174/3002 is still available for exploration and is not reset or reused by these tests. Normal and manual-QA databases and credentials are preserved. No test accepts an arbitrary database target or external base URL.

Two workers run in parallel by default. `--workers=1` is useful while learning/debugging. Each test is independent; filtering or reordering cases should not require another test to have run first. Local retries are zero; CI permits one retry and reports flaky tests separately.

## What is real and what is controlled

| Component                                           | Behavior in automation                                                                                      |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| React pages, forms and routing                      | Real built application in Chromium.                                                                         |
| HTTP routes, authorization, validation and sessions | Real Express app and HttpOnly cookies.                                                                      |
| Booking/payment business logic                      | Real application service and transactions.                                                                  |
| SQLite, migrations, SQL constraints and triggers    | Real file database, isolated per worker.                                                                    |
| Stripe network                                      | Controlled `StripeDouble`, reused from `server/test/stripe-double.js`.                                      |
| Stripe signature verification                       | Actual Stripe SDK signing/verification with a test-only local signing secret.                               |
| Hosted Stripe browser page                          | A clearly labeled controlled page substituted at the external browser network boundary. No card is charged. |
| Weather network                                     | Local provider substitute; success, HTTP error, malformed body and timeout are controlled.                  |

The UI payment journey actually clicks Continue to payment and follows the hosted redirect. The test then tells the provider substitute that payment completed and opens the normal return URL; the real application verifies that result before creating a booking. Provider controls are available only inside the test process. No test-only HTTP endpoints or payment bypasses were added to the product.

These tests verify StayFinder's payment integration behavior. They do not prove that the real Stripe hosted card form accepts a card, handles 3-D Secure or processes a bank transaction. Keep a separate supervised Stripe Sandbox smoke check using the official test cards described in [payments](../docs/payments.md). Real sandbox secrets never enter this automated suite. The existing history of manual sandbox checks is in [verification](../docs/verification.md).

## Coverage and evidence

See [the test strategy](test-strategy.md) and [endpoint matrix](endpoint-matrix.md). The contract test fails when OpenAPI adds/removes an operation without updating its mapping.

After a run:

- `reports/html/index.html`: results, steps, errors and attachments.
- `reports/junit.xml`: machine-readable results for CI.
- `reports/results.json`: Playwright JSON results.
- `reports/endpoint-coverage.md` and `.json`: actual observed documented operations and response statuses.
- `test-results/`: retained browser traces/screenshots/videos on failure; API failures also have traces and a limited database summary.

The endpoint report measures which operations were exercised, including fixture authentication. It is not a code-coverage percentage or proof of complete request/response schema validation. Use assertion results and the case matrix to interpret it. Filtered runs intentionally cover fewer operations.

To inspect a failure, open the HTML report and select its trace. Use the Trace Viewer command shown by Playwright if preferred. Traces contain demo credentials and temporary session cookies; treat shared artifacts as test data and avoid attaching production secrets.

## Adding a test

```javascript
import { test, expect } from "../../fixtures/test.js";
import { stay } from "../../data/builders.js";

test("MY-01 checkout starts unpaid @payments", async ({ actors, system }) => {
  const checkout = await actors.customer.checkout(stay(system.today));
  expect(checkout.booking).toBeNull();
  expect(system.db.one("SELECT count(*) n FROM bookings").n).toBe(0);
});
```

Use the fixture export, not `test` directly from Playwright, when accessing the application. Prefer accessible roles and labels in UI tests. Page Objects encapsulate reusable interactions; assertions remain in tests. Do not add arbitrary sleeps. Use `expect` with locators for asynchronous UI state. Build dates from the server business day.

`system.db.one/all` are for SQL assertions. `system.probeConstraint` is a dedicated rollback-only helper for invalid-write constraint tests. `system.expire`, `system.pay` and `system.reconcile` are explicit scenario controls rather than normal API clients. Never use provider controls as a replacement for assertions through the real API/DB.

## References

The design follows the official Playwright guides for [fixtures](https://playwright.dev/docs/test-fixtures), [API testing](https://playwright.dev/docs/api-testing), [Page Objects](https://playwright.dev/docs/pom), and [reports](https://playwright.dev/docs/test-reporters).


## Page Object Model and fixtures

All UI journeys import `test` and `expect` from `fixtures/ui.fixture.js`. This extends the existing infrastructure fixtures in `fixtures/test.js`, keeping API/DB tests independent of UI abstractions.

| Layer | Responsibility |
| --- | --- |
| `tests/ui/journeys.spec.js` | Scenario order and assertions. No element selectors or Page Object construction. |
| `fixtures/ui.fixture.js` | Creates requested Page Objects for the current test's browser page. Installs/removes the external payment stub and page-error listener when requested. |
| `pages/*.page.js` | Semantic locators and reusable page interactions. Login, catalog, accommodation, checkout, bookings and admin. |
| `pages/components/` | Shared application shell and booking cancellation dialog. |
| `fixtures/test.js` | Real application lifecycle, isolated database, API actors and controlled providers. |
| `api/client.js` | HTTP operations for API tests; API requests do not need browser Page Objects. |

For example:

```javascript
import { test, expect } from '../../fixtures/ui.fixture.js';

test('customer can reach the catalog', async ({ loginPage, catalogPage }) => {
  await loginPage.signIn();
  await expect(catalogPage.heading).toBeVisible();
});
```

`loginPage` and `catalogPage` are fixture names. Playwright creates them on demand, attaches both to the same isolated page for that test and tears down the browser context afterward. Tests do not call `new LoginPage(page)` or duplicate `getByRole`/`getByLabel` selectors. Assertions stay visible in the test; Page Objects expose locators and actions rather than deciding the expected business outcome. Built-in `page` is still used for URL assertions when needed.

The provider substitute stays in `support/hosted-payment-stub.js`: it represents a controlled external boundary, not the real Stripe page. API/DB fixtures remain available in UI tests for arranging data and verifying persisted outcomes.

## Watch UI sanity tests

From the repository root run `npm run test:sanity:ui` to watch the three Chromium sanity journeys, one browser at a time. Use `npm run test:sanity:debug` to step through actions in the Playwright Inspector. The tag `@sanity` defines critical scenarios across both API and UI suites; it does not mean a test is necessarily a browser test. UI sanity cases are UI-01, UI-03 and UI-04 in tests/ui/journeys.spec.js. The file tests/api/sanity.spec.js contains API checks.

On this Windows/npm installation, use named npm scripts or `npm exec -w automation --call "playwright ..."` for custom commands. The alternative `npm exec -w automation -- playwright ...` did not forward arguments correctly during verification and reported No tests found.
