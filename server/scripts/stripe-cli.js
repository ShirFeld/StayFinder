import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
const require = createRequire(import.meta.url);
const root = path.dirname(require.resolve("@stripe/cli/package.json"));
const platforms = JSON.parse(
  readFileSync(path.join(root, "platforms.json"), "utf8"),
);
const platform = platforms[process.platform + "-" + process.arch];
if (!platform)
  throw Error("Stripe CLI is not available for this operating system.");
export const stripeCli = path.join(
  path.dirname(require.resolve(platform.pkg + "/package.json")),
  "bin",
  platform.bin,
);
