import type {
  BookingRow,
  CheckoutRow,
  PropertyRow,
  UserRow,
} from "../../server/src/types.ts";
import type { StripeDouble } from "../../server/test/stripe-double.ts";
import type { ApiClient } from "../api/client.ts";
export type WorkerDatabase = typeof import("../../server/src/database.ts") &
  Pick<typeof import("../../server/src/config.ts"), "config" | "today"> &
  Pick<typeof import("../../server/src/app.ts"), "createApp">;
export type SqlRow<S extends string> = S extends `${string}count(*)${string}`
  ? { n: number }
  : S extends `${string}integrity_check${string}`
    ? { integrity_check: string }
    : S extends `${string}FROM checkouts${string}`
      ? CheckoutRow
      : S extends `${string}FROM bookings${string}`
        ? BookingRow
        : S extends `${string}FROM users${string}`
          ? UserRow
          : S extends `${string}FROM properties${string}`
            ? PropertyRow
            : Record<string, unknown>;
export interface System {
  url: string;
  today: string;
  stripe: StripeDouble;
  weather: { mode: string };
  db: {
    one<S extends string>(sql: S, ...params: unknown[]): SqlRow<S>;
    all<S extends string>(sql: S, ...params: unknown[]): SqlRow<S>[];
  };
  probeConstraint(
    sql: string,
    ...params: unknown[]
  ): { code?: string; message: string } | null;
  pay(checkoutId: string): void;
  expire(checkoutId: string): void;
  reconcile(): Promise<void>;
  signedEvent(
    type: string,
    object: unknown,
    overrides?: Record<string, unknown>,
  ): { payload: string; signature: string };
}
export type Actor = "anonymous" | "admin" | "customer" | "other";
export interface TestFixtures {
  system: System;
  actors: Record<Actor, ApiClient>;
}
export interface WorkerFixtures {
  workerDatabase: WorkerDatabase;
}
