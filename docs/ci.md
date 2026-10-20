# GitHub verification

The workflow in `.github/workflows/automation.yml` runs on pushes to any branch, pull requests and manual dispatch. Merging into `main` updates that branch and triggers another push run.

## Independent checks

| Check name | Command | Preparation |
| --- | --- | --- |
| `quality` | `npm run build` | Install dependencies; check all TypeScript workspaces and build the client. |
| `server-tests` | `npm run test:ci` | Install dependencies; run the Node regression suite with spec, JUnit and TAP reporters. |
| `api-tests` | `npm run test:api` | Install dependencies; set `STAYFINDER_SKIP_CLIENT_BUILD=1`. No browser installation or frontend build. |
| `ui-tests` | `npm run test:ui` | Install dependencies and Chromium/Linux dependencies; build the client and run desktop/mobile UI tests. |
| `summary` | Standalone TypeScript summary script | Wait for all four checks, download available reports, and publish the combined results. |

The first four jobs have no `needs` dependency on each other. A failed group does not stop another group. Playwright has `maxFailures: 0`, so an ordinary test failure does not stop the rest of its suite. CI allows one retry; a test that passes on retry is reported as flaky.

Prerequisites still matter within each group: failed dependency installation prevents that group's tests from starting; failed UI compilation prevents browser journeys. The summary explicitly reports missing results rather than counting unavailable tests as passed. Playwright has a ten-minute global timeout, below the fifteen-minute job timeout, to leave time for its reporters and artifact upload. An externally killed runner can still leave incomplete reports.

The summary runs with `if: always()` and returns failure if a prerequisite job failed, was skipped/cancelled, a test report is missing/invalid, or the reports contain failed/cancelled tests. There is no `continue-on-error` that turns failures green. The script uses only Node built-ins and native TypeScript stripping, so it does not require `npm ci` to have succeeded in another job.

## Reports

Open the workflow run's Summary page for job statuses and per-group passed/failed/flaky/skipped counts. Download artifacts from the same run:

- `quality-reports`: build/type-check log.
- `server-test-reports`: `junit.xml` and `results.tap`, with individual server test names and results.
- `api-test-reports`: `reports/html/index.html`, JUnit/JSON, endpoint exercise reports and retained API failure attachments.
- `ui-test-reports`: the same Playwright reports, plus retained browser traces, screenshots and videos on failure.

Artifacts are uploaded even when tests fail and retained for fourteen days. Each group has a distinct artifact name, so API and UI results do not overwrite one another. Extract the complete Playwright artifact before opening its HTML report, or use `npx playwright show-report <extracted-directory>/reports/html`. Per-group endpoint reports describe only that filtered run and must not be added together as a coverage percentage.

## GitHub repository settings

1. Push these changes on a branch and open a pull request into `main`. Check the Actions tab for `StayFinder verification` and let it finish once, so GitHub discovers the new check names.
2. If Actions is disabled/restricted, enable it under **Settings → Actions → General** and allow the actions used by this workflow. It only needs repository read access; no Stripe, weather or application secrets are required.
3. Under **Settings → Rules → Rulesets**, create or update an active branch ruleset targeting `main` (or use the equivalent branch protection settings available to your repository).
4. Enable **Require a pull request before merging** and **Require status checks to pass**. Select `quality`, `server-tests`, `api-tests`, `ui-tests`, and `summary` from GitHub Actions. Remove the previous required `automation` check if it was configured, because this workflow replaces it.
5. Enable **Require branches to be up to date before merging** if every PR should be checked against the latest `main`. Keep bypass permissions limited to the maintainers who should have them.

Repository settings are separate from committed workflow files. Their availability depends on the repository/account plan. This change does not configure a merge queue; if one is enabled later, add a `merge_group` trigger before requiring these checks for the queue.

## Local commands

Existing commands retain their meaning. `npm run test:ci` additionally writes server reports to ignored `server/reports/` and returns a nonzero exit code on failure. For API-only execution without a frontend build in PowerShell:

```powershell
$env:STAYFINDER_SKIP_CLIENT_BUILD = "1"
npm run test:api
Remove-Item Env:STAYFINDER_SKIP_CLIENT_BUILD
```

`CI=true` selects headless browser execution; local runs continue to open a browser by default. Use `--headed` when deliberately debugging CI-like runs locally. Default automated suites use only disposable databases and controlled payment/weather providers.
