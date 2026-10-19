import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export default function buildClient() {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  // Build once before workers; the real Express app serves the resulting UI.
  const result = spawnSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "build"],
    {
      cwd: root,
      stdio: "inherit",
      shell: process.platform === "win32",
    },
  );
  if (result.status !== 0)
    throw new Error("Client build failed; automation was not started.");
}
