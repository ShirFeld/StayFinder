import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const manifest = JSON.parse(
  readFileSync(new URL("../data/endpoints.json", import.meta.url), "utf8"),
);

export default class EndpointReporter {
  observed = new Map();
  onTestEnd(test, result) {
    for (const attachment of result.attachments.filter(
      (a) => a.name === "endpoint-exercise",
    )) {
      const rows = JSON.parse(
        attachment.body
          ? attachment.body.toString()
          : readFileSync(attachment.path, "utf8"),
      );
      for (const row of rows) {
        const match = Object.keys(manifest).find((key) => {
          const [method, route] = key.split(" ");
          return (
            method === row.method &&
            new RegExp("^" + route.replaceAll("{id}", "[^/]+") + "$").test(
              row.path,
            )
          );
        });
        if (!match) continue;
        const statuses = this.observed.get(match) || new Set();
        statuses.add(row.status);
        this.observed.set(match, statuses);
      }
    }
  }
  onEnd() {
    const folder = fileURLToPath(new URL("../reports/", import.meta.url));
    mkdirSync(folder, { recursive: true });
    const endpoints = Object.entries(manifest).map(([endpoint, cases]) => ({
      endpoint,
      cases,
      exercised: this.observed.has(endpoint),
      statuses: [...(this.observed.get(endpoint) || [])].sort(),
    }));
    const exercised = endpoints.filter((row) => row.exercised).length;
    writeFileSync(
      path.join(folder, "endpoint-coverage.json"),
      JSON.stringify(
        { exercised, total: endpoints.length, endpoints },
        null,
        2,
      ),
    );
    writeFileSync(
      path.join(folder, "endpoint-coverage.md"),
      "# Endpoint exercise report\n\n" +
        `${exercised}/${endpoints.length} documented operations exercised in this run.\n\n` +
        "This measures HTTP operations observed, including fixture setup. It is not code coverage, schema coverage or proof that every scenario passed. Consult the test report for assertion results. Filtered runs intentionally exercise fewer operations.\n\n" +
        "| Operation | Observed statuses | Test cases |\n| --- | --- | --- |\n" +
        endpoints
          .map(
            (row) =>
              `| ${row.endpoint} | ${row.statuses.join(", ") || "Not exercised"} | ${row.cases} |`,
          )
          .join("\n") +
        "\n",
    );
    console.log(
      `Endpoint exercise: ${exercised}/${endpoints.length} documented operations (see automation/reports).`,
    );
  }
}
