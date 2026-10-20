import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  jobIds,
  parsePlaywright,
  parseTap,
  summarize,
  type JobResults,
} from "../../.github/scripts/verification-summary.ts";

const tap = (failed = 0) =>
  `TAP version 13\nok 1 - first test\n# tests 2\n# suites 0\n# pass ${2 - failed}\n# fail ${failed}\n# cancelled 0\n# skipped 0\n# todo 0\n`;
const playwright = (unexpected = 0, flaky = 0) =>
  JSON.stringify({
    errors: [],
    stats: { expected: 3, unexpected, flaky, skipped: 1 },
  });

test("CI summary reads final TAP totals rather than indented child/log output", () => {
  const counts = parseTap("    # pass 900\n" + tap(1));
  assert.equal(counts.passed, 1);
  assert.equal(counts.failed, 1);
  assert.throws(() => parseTap("TAP version 13\n# pass 2\n"), /Incomplete TAP/);
});

test("CI summary distinguishes flaky, skipped and failed Playwright tests", () => {
  assert.deepEqual(parsePlaywright(playwright(1, 2)), {
    passed: 3,
    failed: 1,
    flaky: 2,
    skipped: 1,
    cancelled: 0,
    todo: 0,
  });
  assert.throws(
    () => parsePlaywright('{"errors":[{"message":"setup failed"}],"stats":{}}'),
    /global setup/,
  );
  assert.throws(
    () =>
      parsePlaywright(
        '{"errors":[],"stats":{"expected":0,"unexpected":0,"skipped":0,"flaky":0}}',
      ),
    /No Playwright tests/,
  );
  assert.throws(
    () => parsePlaywright('{"errors":[],"stats":{"expected":-1}}'),
    /Invalid or missing/,
  );
});

test("CI summary preserves failures while collecting all independent results", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "stayfinder-ci-summary-"));
  const write = (file: string, content: string) => {
    const target = path.join(directory, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
  };
  const jobs = Object.fromEntries(
    jobIds.map((id) => [id, { result: "success" }]),
  ) as JobResults;
  try {
    write("server-test-reports/results.tap", tap());
    write("api-test-reports/reports/results.json", playwright());
    write("ui-test-reports/reports/results.json", playwright());
    assert.equal(summarize(directory, jobs).success, true);

    // A quality failure must not erase results from the passing test groups.
    jobs.quality = { result: "failure" };
    const qualityFailure = summarize(directory, jobs);
    assert.equal(qualityFailure.success, false);
    assert.match(qualityFailure.markdown, /quality \| failure/);
    assert.match(qualityFailure.markdown, /Desktop and mobile UI \| 3/);

    jobs.quality = { result: "success" };
    write("server-test-reports/results.tap", tap(1));
    assert.equal(summarize(directory, jobs).success, false);
    write("server-test-reports/results.tap", tap());
    write("api-test-reports/reports/results.json", playwright(1));
    assert.equal(summarize(directory, jobs).success, false);

    write("api-test-reports/reports/results.json", "incomplete JSON");
    const corrupt = summarize(directory, jobs);
    assert.equal(corrupt.success, false);
    assert.match(corrupt.markdown, /Desktop and mobile UI \| 3/);
    rmSync(path.join(directory, "ui-test-reports/reports/results.json"));
    assert.match(summarize(directory, jobs).markdown, /Report unavailable/);
    assert.equal(summarize(directory, {}).success, false);
  } finally {
    assert.ok(
      path.resolve(directory).startsWith(path.resolve(tmpdir()) + path.sep),
    );
    assert.ok(path.basename(directory).startsWith("stayfinder-ci-summary-"));
    rmSync(directory, { recursive: true, force: true });
  }
});
