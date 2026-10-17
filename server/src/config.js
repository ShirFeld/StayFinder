import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
export const serverRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export const config = {
  sessionName: process.env.SESSION_COOKIE_NAME || "stayfinder.sid",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
  checkoutOrigin:
    process.env.CHECKOUT_ORIGIN ||
    process.env.APP_ORIGIN ||
    "http://localhost:5173",
  port: Number(process.env.PORT || 3001),
  dbPath:
    process.env.DB_PATH === ":memory:"
      ? ":memory:"
      : path.resolve(
          serverRoot,
          process.env.DB_PATH || "./data/stayfinder.sqlite",
        ),
  secret:
    process.env.SESSION_SECRET || "local-demo-secret-change-before-deployment",
  origin: process.env.APP_ORIGIN || "http://localhost:5173",
  timezone: process.env.APP_TIMEZONE || "Asia/Jerusalem",
  weatherUrl:
    process.env.WEATHER_BASE_URL || "https://api.open-meteo.com/v1/forecast",
  weatherTimeout: Number(process.env.WEATHER_TIMEOUT_MS || 4000),
  production: process.env.NODE_ENV === "production",
};
if (
  config.production &&
  (!process.env.SESSION_SECRET || config.secret.length < 32)
)
  throw new Error(
    "Set a SESSION_SECRET of at least 32 characters in production.",
  );
export function today() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: config.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type).value;
  return get("year") + "-" + get("month") + "-" + get("day");
}

if (
  config.stripeSecretKey &&
  !/^(sk|rk|rkcs)_test_/.test(config.stripeSecretKey)
)
  throw new Error(
    "StayFinder accepts Stripe sandbox keys only. Live payments are disabled.",
  );
