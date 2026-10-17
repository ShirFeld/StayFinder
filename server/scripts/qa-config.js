import path from "node:path";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import dotenv from "dotenv";

// QA variables are explicit. Normal Stripe keys and normal database settings are never inherited.
export function qaEnvironment(serverRoot, environment = process.env, settings) {
  const file = path.join(serverRoot, "qa.env");
  const values = {
    ...(settings ?? (existsSync(file) ? dotenv.parse(readFileSync(file)) : {})),
    ...environment,
  };
  const qaRoot = path.join(serverRoot, "data", "qa");
  const database = path.resolve(
    serverRoot,
    values.QA_DB_PATH || "./data/qa/stayfinder.sqlite",
  );
  const relative = path.relative(qaRoot, database);
  if (
    !relative ||
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    !database.endsWith(".sqlite")
  )
    throw Error(
      "QA_DB_PATH must be a .sqlite file inside server/data/qa. The normal practice database cannot be used.",
    );
  let parent = path.dirname(database);
  while (!existsSync(parent)) parent = path.dirname(parent);
  const actualParent = realpathSync(parent);
  const normalized = (value) =>
    process.platform === "win32" ? value.toLowerCase() : value;
  if (normalized(actualParent) !== normalized(parent))
    throw Error(
      "QA database parent must not redirect through a symbolic link or junction.",
    );
  return {
    ...environment,
    NODE_ENV: "development",
    PORT: "3002",
    APP_ORIGIN: "http://localhost:5174",
    CHECKOUT_ORIGIN: "http://localhost:5174",
    DB_PATH: database,
    SESSION_COOKIE_NAME: "stayfinder.qa.sid",
    SESSION_SECRET: "stayfinder-isolated-qa-session-secret",
    APP_TIMEZONE: values.QA_TIMEZONE || "Asia/Jerusalem",
    STRIPE_SECRET_KEY: values.QA_STRIPE_SECRET_KEY || "",
    STRIPE_WEBHOOK_SECRET: values.QA_STRIPE_WEBHOOK_SECRET || "",
    WEATHER_BASE_URL:
      values.QA_WEATHER_BASE_URL || "http://127.0.0.1:3999/weather",
    WEATHER_TIMEOUT_MS: values.QA_WEATHER_TIMEOUT_MS || "1000",
    STAYFINDER_API_TARGET: "http://127.0.0.1:3002",
  };
}
