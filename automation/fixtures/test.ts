import type { APIRequestContext } from "@playwright/test";
import {
  test as base,
  expect,
  request as playwrightRequest,
} from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import type { BookingRow, CheckoutRow } from "../../server/src/types.ts";
import { StripeDouble } from "../../server/test/stripe-double.ts";
import { ApiClient } from "../api/client.ts";
import { accounts } from "../data/builders.ts";
import type {
  Actor,
  SqlRow,
  System,
  TestFixtures,
  WorkerFixtures,
} from "./types.ts";

export const test = base.extend<TestFixtures, WorkerFixtures>({
  workerDatabase: [
    async ({}, use) => {
      const directory = await mkdtemp(
        path.join(tmpdir(), "stayfinder-automation-"),
      );
      // Override every application environment input BEFORE importing the app.
      // Neither normal .env nor QA credentials/database are inherited.
      Object.assign(process.env, {
        DOTENV_CONFIG_PATH: path.join(directory, "no-env-file"),
        DB_PATH: path.join(directory, "automation.sqlite"),
        NODE_ENV: "test",
        SESSION_COOKIE_NAME: "stayfinder.automation.sid",
        SESSION_SECRET:
          "isolated-automation-session-secret-at-least-32-characters",
        STRIPE_SECRET_KEY: "",
        STRIPE_WEBHOOK_SECRET: "whsec_automation_only",
        APP_ORIGIN: "http://127.0.0.1",
        CHECKOUT_ORIGIN: "http://127.0.0.1",
        APP_TIMEZONE: "Asia/Jerusalem",
        WEATHER_TIMEOUT_MS: "100",
      });
      const database = await import("../../server/src/database.ts");
      const { config, today } = await import("../../server/src/config.ts");
      const { createApp } = await import("../../server/src/app.ts");
      try {
        await use({ ...database, config, today, createApp });
      } finally {
        database.db.close();
        // Only remove the unique directory returned by mkdtemp above.
        await rm(directory, { recursive: true, force: true });
      }
    },
    { scope: "worker" },
  ],

  system: async ({ workerDatabase }, use, testInfo) => {
    const { db, seed, migrate, config, today, createApp } = workerDatabase;
    migrate();
    db.transaction(() => {
      for (const table of [
        "sessions",
        "bookings",
        "checkouts",
        "properties",
        "users",
      ])
        db.prepare(`DELETE FROM ${table}`).run();
    })();
    seed();
    const stripe = new StripeDouble();
    const weather = { mode: "ok" };
    const weatherServer = http.createServer((req, res) => {
      res.setHeader("Content-Type", "application/json");
      if (weather.mode === "timeout") return; // Destroyed by teardown, timeout handled by real API.
      if (weather.mode === "http") {
        res.writeHead(502);
        res.end("{}");
        return;
      }
      res.end(
        JSON.stringify(
          weather.mode === "malformed"
            ? {}
            : {
                current: {
                  temperature_2m: 23,
                  weather_code: 0,
                  wind_speed_10m: 7,
                  time: today() + "T12:00",
                },
              },
        ),
      );
    });
    await new Promise<void>((resolve) =>
      weatherServer.listen(0, "127.0.0.1", resolve),
    );
    config.weatherUrl = `http://127.0.0.1:${(weatherServer.address() as AddressInfo).port}/weather`;
    const app = createApp({ stripe });
    const exercised: { method?: string; path: string; status: number }[] = [];
    // Observe real HTTP responses outside Express; never add test-only routes to the product.
    const server = http.createServer((req, res) => {
      const requestPath = new URL(req.url!, "http://127.0.0.1").pathname;
      res.on("finish", () =>
        exercised.push({
          method: req.method,
          path: requestPath,
          status: res.statusCode,
        }),
      );
      app(req, res);
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    config.checkoutOrigin = url;
    const system: System = {
      url,
      today: today(),
      stripe,
      weather,
      // Read-only DB facade for assertions. State mutations belong only to explicit scenario controls below.
      db: {
        one: <S extends string>(sql: S, ...params: unknown[]) => {
          const statement = db.prepare(sql);
          if (!statement.reader)
            throw Error("DB assertions must use read-only queries.");
          return statement.get(...params) as SqlRow<S>;
        },
        all: <S extends string>(sql: S, ...params: unknown[]) => {
          const statement = db.prepare(sql);
          if (!statement.reader)
            throw Error("DB assertions must use read-only queries.");
          return statement.all(...params) as SqlRow<S>[];
        },
      },
      probeConstraint(sql, ...params) {
        db.exec("SAVEPOINT automation_constraint_probe");
        try {
          db.prepare(sql).run(...params);
          return null;
        } catch (error) {
          const failure = error as Error & { code?: string };
          return { code: failure.code, message: failure.message };
        } finally {
          db.exec(
            "ROLLBACK TO automation_constraint_probe; RELEASE automation_constraint_probe",
          );
        }
      },
      pay(checkoutId) {
        stripe.pay(
          db
            .prepare<unknown[], CheckoutRow>(
              "SELECT stripe_session_id FROM checkouts WHERE id=?",
            )
            .get(checkoutId)!.stripe_session_id!,
        );
      },
      expire(checkoutId) {
        const row = db
          .prepare<unknown[], CheckoutRow>(
            "SELECT stripe_session_id FROM checkouts WHERE id=?",
          )
          .get(checkoutId)!;
        db.prepare(
          "UPDATE checkouts SET expires_at=unixepoch()-1 WHERE id=?",
        ).run(checkoutId);
        stripe.sessions.get(row.stripe_session_id!)!.status = "expired";
      },
      reconcile: () => app.locals.payments.reconcile(),
      signedEvent(type, object, overrides = {}) {
        const payload = JSON.stringify({
          id: "evt_automation",
          type,
          livemode: false,
          data: { object },
          ...overrides,
        });
        return {
          payload,
          signature: stripe.webhooks.generateTestHeaderString({
            payload,
            secret: config.stripeWebhookSecret,
          }),
        };
      },
    };
    try {
      await use(system);
    } finally {
      await testInfo.attach("endpoint-exercise", {
        contentType: "application/json",
        body: JSON.stringify(exercised),
      });
      if (testInfo.status !== testInfo.expectedStatus) {
        await testInfo.attach("database-summary", {
          contentType: "application/json",
          body: JSON.stringify(
            {
              bookings: db
                .prepare<unknown[], BookingRow>(
                  "SELECT id,property_id,status,payment_status,total_cents FROM bookings",
                )
                .all(),
              checkouts: db
                .prepare<unknown[], CheckoutRow>(
                  "SELECT id,property_id,status,refund_status,total_cents FROM checkouts",
                )
                .all(),
            },
            null,
            2,
          ),
        });
      }
      server.closeAllConnections();
      weatherServer.closeAllConnections();
      await Promise.all([
        new Promise((r) => server.close(r)),
        new Promise((r) => weatherServer.close(r)),
      ]);
    }
  },
  baseURL: async ({ system }, use) => {
    await use(system.url);
  },
  actors: async ({ system }, use) => {
    const contexts: APIRequestContext[] = [];
    const clients = {} as Record<Actor, ApiClient>;
    try {
      for (const role of ["anonymous", ...Object.keys(accounts)] as Actor[]) {
        const context = await playwrightRequest.newContext({
          baseURL: system.url,
        });
        contexts.push(context);
        const client = new ApiClient(context);
        if (role !== "anonymous")
          await client.post("/auth/login", accounts[role]);
        clients[role] = client;
      }
      await use(clients);
    } finally {
      await Promise.all(contexts.map((context) => context.dispose()));
    }
  },
});
export { expect };
