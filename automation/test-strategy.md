# Test strategy and interview walkthrough

## Scope and layers

- API regression is the largest layer: direct HTTP requests verify role boundaries, validation and business state transitions cheaply.
- SQL checks verify persisted relationships, financial snapshots, history, migrations, indexes, foreign keys, uniqueness, arithmetic checks and overlap triggers.
- A smaller UI layer proves user journeys through real pages and the API on desktop and mobile Chromium.
- The existing Node server suite remains a complementary lower-level regression layer, not a dependency or prerequisite for any individual Playwright test.

## Critical scenarios

| Area                         | Cases                                                                                                                                           |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Sanity and session lifecycle | SAN-01/02; UI-01/03/04; WEA-01; DB-01.                                                                                                          |
| Authorization                | AUTH-01/02, ADM-03, PAY-05, UI-06.                                                                                                              |
| Catalog and price quote      | CAT-01/02/03/04: filters, sorting, pagination, invalid dates/guests and unknown resources.                                                      |
| Payment lifecycle            | PAY-01/02/03/11: unpaid hold, verification, immutable price, exactly one booking and idempotent retries.                                        |
| Concurrency and availability | PAY-04/08/10: competing HTTP requests, expired holds, late payment and adjacent bookings.                                                       |
| Cancellation and refunds     | PAY-06/07/12/13/14/15: refund amount, retry, provider outages, reconciliation, races and disabled listings.                                     |
| Webhooks                     | HOOK-01/02: actual SDK signatures, duplicate events, forged signatures and rejected live events.                                                |
| Administration               | ADM-01/02/03 and UI-07: CRUD lifecycle, unique email, role changes and session revocation.                                                      |
| External failures            | WEA-02, PAY-07/09/12: controlled timeouts, malformed responses, ambiguous provider acceptance and recovery.                                     |
| Database                     | DB-01/02/03/04: integrity, persisted history, invalid writes and direct overlap enforcement.                                                    |
| UX and accessibility smoke   | UI-02/03/05/06/08: errors, navigation state, reload recovery, empty states and keyboard skip link. UI-04 checks safe cancellation focus/Escape. |
| Contract drift               | CON-01: every documented API operation has a mapping to test cases.                                                                             |

## Suggested interview demonstration

1. Show `playwright.config.ts`: separate projects, two workers, failure artifacts and explicit retry policy.
2. Explain `fixtures/test.ts`: private per-worker DB, clean per-test seeds, separate authenticated users and deterministic providers. Then show `fixtures/ui.fixture.ts`, which injects test-scoped Page Objects into UI tests.
3. Run `npm run test:sanity` and open the HTML report.
4. Open PAY-04 to explain why two concurrent callers must receive one success and one conflict.
5. Open PAY-02 and DB-02 to show how an HTTP result is checked against the stored price snapshot and exactly-one booking relationship.
6. Open PAY-09 to explain idempotency after a provider accepted a request but its response was lost.
7. Open PAY-07/PAY-12/PAY-15 to discuss durable cancellation intent, refund failure and safe recovery.
8. Show UI-04 and explain the external-provider boundary honestly: the application is real, but the hosted provider and network are controlled.
9. Show endpoint-coverage.md, distinguish exercised operations from business-case completeness/code coverage, and explain the CI artifact workflow.

## CI and execution policy

The GitHub Actions workflow runs independent quality/build, Node server, Playwright API/DB and Playwright UI jobs. Each installs its own dependencies; only the UI job installs Chromium and builds the frontend. Playwright continues after test failures (`maxFailures: 0`) and runs headlessly on CI. A final always-running summary collects job states and available report counts, and stays failed when any required group fails or reports are unavailable. Each group uploads distinct artifacts even on failure for fourteen days. It runs on pushes, pull requests and manual dispatch. See [the CI guide](../docs/ci.md) for exact check names, report paths, prerequisite failures and GitHub settings. A successful local run does not mean a hosted CI run has already occurred.

## Limits and next extensions

This is a functional regression foundation, not exhaustive quality certification. Chromium mobile emulation is not a real mobile device or Safari test. Firefox/WebKit, full accessibility auditing, visual snapshots, performance/load, multi-process booking stress, penetration testing, full JSON-schema response validation, 3-D Secure and real Stripe sandbox UI automation are not part of the default suite. No payment decline from a real bank is simulated: an unpaid provider session simply must not create a booking.

The tests start the app through its existing factory. Scheduled reconciliation is invoked explicitly to avoid waiting for wall-clock intervals; production startup/periodic scheduling is not exercised by that invocation. External API behavior changes still require a separate sandbox smoke check. Temporary files can remain after a forcibly terminated worker; these are distinct OS temporary directories, never the application databases.

## POM walkthrough

Follow UI-04 from its fixture arguments into StayPage, CheckoutPage and BookingsPage. Locators and interactions live in those objects; the shared CancellationDialog component handles the dialog. The test keeps the cross-page scenario and assertions. UI fixtures construct the objects on demand; API tests continue to use the infrastructure fixtures and HTTP client without browser page dependencies.
