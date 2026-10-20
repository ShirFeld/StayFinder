import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const jobIds = [
  "quality",
  "server-tests",
  "api-tests",
  "ui-tests",
] as const;
export type JobResults = Partial<
  Record<(typeof jobIds)[number], { result: string }>
>;
export interface Counts {
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  cancelled: number;
  todo: number;
}
interface Report {
  counts?: Counts;
  issue?: string;
}

const number = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw Error("Invalid or missing test count");
  return value;
};

export function parseTap(source: string): Counts {
  const count = (name: string) => {
    const matches = [
      ...source.matchAll(new RegExp(`^# ${name} (\\d+)\\r?$`, "gm")),
    ];
    if (!matches.length) throw Error(`Incomplete TAP report: missing ${name}`);
    return number(Number(matches.at(-1)![1]));
  };
  if (!count("tests")) throw Error("No server tests were reported");
  return {
    passed: count("pass"),
    failed: count("fail"),
    flaky: 0,
    skipped: count("skipped"),
    cancelled: count("cancelled"),
    todo: count("todo"),
  };
}

export function parsePlaywright(source: string): Counts {
  const report = JSON.parse(source) as {
    stats?: Record<string, unknown>;
    errors?: unknown[];
  };
  if (!report.stats || !Array.isArray(report.errors))
    throw Error("Incomplete Playwright report");
  if (report.errors.length)
    throw Error(
      "Playwright reported a global setup or runner error; inspect its report",
    );
  const counts = {
    passed: number(report.stats.expected),
    failed: number(report.stats.unexpected),
    flaky: number(report.stats.flaky),
    skipped: number(report.stats.skipped),
    cancelled: 0,
    todo: 0,
  };
  if (!Object.values(counts).some(Boolean))
    throw Error("No Playwright tests were reported");
  return counts;
}

export function summarize(
  directory: string,
  jobs: JobResults,
): { markdown: string; success: boolean } {
  const read = (file: string, parse: (source: string) => Counts): Report => {
    try {
      return {
        counts: parse(readFileSync(path.join(directory, file), "utf8")),
      };
    } catch (error) {
      const failure = error as Error & { code?: string };
      return {
        issue:
          failure.code === "ENOENT"
            ? "Report unavailable; inspect setup and job logs"
            : failure.message,
      };
    }
  };
  const reports = [
    {
      name: "Server",
      artifact: "server-test-reports",
      report: read("server-test-reports/results.tap", parseTap),
    },
    {
      name: "API and database",
      artifact: "api-test-reports",
      report: read("api-test-reports/reports/results.json", parsePlaywright),
    },
    {
      name: "Desktop and mobile UI",
      artifact: "ui-test-reports",
      report: read("ui-test-reports/reports/results.json", parsePlaywright),
    },
  ];
  const success =
    jobIds.every((id) => jobs[id]?.result === "success") &&
    reports.every(
      ({ report }) =>
        report.counts && !report.counts.failed && !report.counts.cancelled,
    );
  const rows = reports.map(({ name, artifact, report }) => {
    const c = report.counts;
    return c
      ? `| ${name} | ${c.passed} | ${c.failed} | ${c.flaky} | ${c.skipped} | ${c.cancelled} | ${c.todo} | ${artifact} |`
      : `| ${name} | — | — | — | — | — | — | ${report.issue} |`;
  });
  return {
    success,
    markdown: [
      "# StayFinder verification",
      "",
      success
        ? "All verification groups passed."
        : "Verification failed or could not complete. Review failed jobs and unavailable reports.",
      "",
      "| Check | Job result |",
      "| --- | --- |",
      ...jobIds.map((id) => `| ${id} | ${jobs[id]?.result ?? "unavailable"} |`),
      "",
      "| Suite | Passed | Failed | Flaky | Skipped | Cancelled | Todo | Artifact / note |",
      "| --- | --- | --- | --- | --- | --- | --- | --- |",
      ...rows,
      "",
      "Download the named artifacts from this workflow run. Playwright reports contain reports/html/index.html, JUnit and JSON, plus retained failure traces/screenshots/videos. Server reports contain per-test results in junit.xml and results.tap. quality-reports contains the build/type-check log.",
      "",
      "Flaky means a Playwright test passed on retry; retries are not counted as extra tests. Missing reports are not treated as passing or as zero failures. Setup/build failures can prevent dependent tests from running; independent groups still run.",
      "",
    ].join("\n"),
  };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const jobs = JSON.parse(process.env.VERIFICATION_JOBS || "{}") as JobResults;
  const result = summarize(
    path.resolve(process.argv[2] || "ci-artifacts"),
    jobs,
  );
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, result.markdown);
  console.log(result.markdown);
  process.exitCode = result.success ? 0 : 1;
}
