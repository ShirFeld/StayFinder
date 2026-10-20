import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = fileURLToPath(new URL("../", import.meta.url));
const reports = path.join(serverRoot, "reports");
mkdirSync(reports, { recursive: true });
const tests = readdirSync(path.join(serverRoot, "test"))
  .filter((file) => file.endsWith(".test.ts"))
  .sort()
  .map((file) => path.join(serverRoot, "test", file));

const result = spawnSync(
  process.execPath,
  [
    "--import",
    "tsx",
    "--test",
    "--test-concurrency=1",
    "--test-reporter=spec",
    "--test-reporter-destination=stdout",
    "--test-reporter=junit",
    `--test-reporter-destination=${path.join(reports, "junit.xml")}`,
    "--test-reporter=tap",
    `--test-reporter-destination=${path.join(reports, "results.tap")}`,
    ...tests,
  ],
  { cwd: serverRoot, stdio: "inherit", windowsHide: true },
);

if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
