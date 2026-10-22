import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { qaEnvironment } from "./qa-config.ts";
const serverRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  ),
  root = path.dirname(serverRoot);
const env = qaEnvironment(serverRoot),
  command = process.argv[2];
if (
  !["dev", "api", "client", "migrate", "seed", "reset", "status"].includes(
    command,
  )
)
  throw Error(
    "Use dev, api, client, migrate, seed, reset --confirm, or status.",
  );
if (command === "reset" && !process.argv.includes("--confirm"))
  throw Error("QA reset deletes QA data. Pass --confirm explicitly.");
if (command === "status") {
  const info: Record<string, unknown> = {
    database: env.DB_PATH,
    api: "http://localhost:3002",
    ui: "http://localhost:5174",
    cookie: env.SESSION_COOKIE_NAME,
    payments: env.STRIPE_SECRET_KEY
      ? "Stripe sandbox configured"
      : "Disabled; integration tests use a controlled provider double",
    weather: env.WEATHER_BASE_URL,
  };
  if (existsSync(env.DB_PATH)) {
    const { default: Database } = await import("better-sqlite3");
    const db = new Database(env.DB_PATH, {
      readonly: true,
      fileMustExist: true,
    });
    try {
      info.counts = Object.fromEntries(
        ["users", "properties", "bookings", "checkouts"].map((table) => [
          table,
          db
            .prepare<unknown[], { n: number }>(
              "SELECT count(*) n FROM " + table,
            )
            .get()!.n,
        ]),
      );
    } finally {
      db.close();
    }
  }
  console.log(JSON.stringify(info, null, 2));
} else {
  let args,
    cwd = root;
  if (command === "dev")
    args = [
      path.join(root, "node_modules/concurrently/dist/bin/concurrently.js"),
      "-k",
      "-n",
      "QA-API,QA-UI",
      "npm run qa:api",
      "npm run qa:client",
    ];
  else if (command === "api")
    args = [
      "--import",
      "tsx",
      "--watch",
      path.join(serverRoot, "src/index.ts"),
    ];
  else if (command === "client") {
    args = [
      path.join(root, "node_modules/vite/bin/vite.js"),
      "--host",
      "127.0.0.1",
      "--port",
      "5174",
      "--strictPort",
    ];
    cwd = path.join(root, "client");
  } else
    args = [
      "--import",
      "tsx",
      path.join(serverRoot, "src/database.ts"),
      command,
      ...(command === "reset" ? ["--confirm"] : []),
    ];
  console.log("QA only: " + env.DB_PATH);
  const child = spawn(process.execPath, args, {
    cwd,
    env,
    windowsHide: true,
    stdio: "inherit",
  });
  child.on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    process.exitCode = code || 0;
  });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => child.kill(signal as NodeJS.Signals));
}
