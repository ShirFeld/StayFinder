import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { stripeCli } from "./stripe-cli.js";
const serverRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const envFile = path.join(serverRoot, ".env");
dotenv.config({ path: envFile });
const key = process.env.STRIPE_SECRET_KEY;
if (!/^(sk|rk|rkcs)_test_/.test(key || ""))
  throw Error(
    "Configure a Stripe test key in server/.env before starting the webhook listener.",
  );
const data = path.join(serverRoot, "data");
mkdirSync(data, { recursive: true });
const port = process.env.PORT || 3001;
const child = spawn(
  stripeCli,
  [
    "--config",
    path.join(data, "stripe-cli.toml"),
    "listen",
    "--forward-to",
    "http://127.0.0.1:" + port + "/api/payments/webhook",
    "--events",
    "checkout.session.completed,checkout.session.expired,checkout.session.async_payment_succeeded,refund.updated,refund.failed",
  ],
  {
    windowsHide: true,
    env: { ...process.env, STRIPE_API_KEY: key },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
const sanitize = (text) =>
  text
    .replace(/(?:sk|rk|rkcs|pk)_(?:test|live)_[A-Za-z0-9_]+/g, "[REDACTED_KEY]")
    .replace(/whsec_[A-Za-z0-9]+/g, "[SIGNING_SECRET_SAVED]");
let buffered = "";
function log(chunk) {
  buffered += chunk.toString();
  let index;
  while ((index = buffered.indexOf("\n")) >= 0) {
    const line = buffered.slice(0, index);
    buffered = buffered.slice(index + 1);
    const secret = line.match(/whsec_[A-Za-z0-9]+/)?.[0];
    if (secret) {
      let env = existsSync(envFile) ? readFileSync(envFile, "utf8") : "";
      if (!env.includes("STRIPE_WEBHOOK_SECRET=" + secret)) {
        env = env.replace(/^STRIPE_WEBHOOK_SECRET=.*\r?\n?/gm, "");
        writeFileSync(
          envFile,
          env + "\nSTRIPE_WEBHOOK_SECRET=" + secret + "\n",
        );
        console.log(
          "Webhook signing secret saved to server/.env. Restart the API if it is already running.",
        );
      }
    }
    console.log(sanitize(line));
  }
}
child.stdout.on("data", log);
child.stderr.on("data", log);
child.on("error", () => {
  console.error(
    "Could not start the Stripe CLI. Run npm install and try again.",
  );
  process.exitCode = 1;
});
child.on("exit", (code) => {
  if (buffered) console.log(sanitize(buffered));
  process.exitCode = code || 0;
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill());
