import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { qaEnvironment } from "../scripts/qa-config.js";
const serverRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
test("QA environment isolates database, ports, cookies and external credentials", () => {
  const env = qaEnvironment(
    serverRoot,
    {
      DB_PATH: "./data/stayfinder.sqlite",
      PORT: "3001",
      STRIPE_SECRET_KEY: "sk_test_normal_environment",
      STRIPE_WEBHOOK_SECRET: "whsec_normal",
    },
    {},
  );
  assert.equal(
    env.DB_PATH,
    path.join(serverRoot, "data", "qa", "stayfinder.sqlite"),
  );
  assert.equal(env.PORT, "3002");
  assert.equal(env.APP_ORIGIN, "http://localhost:5174");
  assert.equal(env.SESSION_COOKIE_NAME, "stayfinder.qa.sid");
  assert.equal(env.STRIPE_SECRET_KEY, "");
  assert.equal(env.STRIPE_WEBHOOK_SECRET, "");
});
test("QA reset cannot target the normal database or escape the QA directory", () => {
  for (const dbPath of [
    "./data/stayfinder.sqlite",
    "../README.md",
    "./data/qa/../stayfinder.sqlite",
    "./data/qa",
  ])
    assert.throws(
      () => qaEnvironment(serverRoot, { QA_DB_PATH: dbPath }, {}),
      /QA_DB_PATH/,
    );
});
test("QA only uses intentionally supplied QA-specific provider settings", () => {
  const env = qaEnvironment(
    serverRoot,
    {
      QA_STRIPE_SECRET_KEY: "sk_test_explicit_qa",
      QA_STRIPE_WEBHOOK_SECRET: "whsec_qa",
      QA_WEATHER_BASE_URL: "http://127.0.0.1:5000/weather",
    },
    {},
  );
  assert.equal(env.STRIPE_SECRET_KEY, "sk_test_explicit_qa");
  assert.equal(env.STRIPE_WEBHOOK_SECRET, "whsec_qa");
  assert.equal(env.WEATHER_BASE_URL, "http://127.0.0.1:5000/weather");
});
