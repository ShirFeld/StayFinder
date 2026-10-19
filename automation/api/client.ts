import type { APIRequestContext } from "@playwright/test";
import { expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
interface CallOptions {
  data?: unknown;
  headers?: Record<string, string>;
  status?: number;
}

// HTTP-only helper: it never reads the database or changes provider state.
export class ApiClient {
  constructor(readonly context: APIRequestContext) {}
  async call(
    method: string,
    path: string,
    { data, headers, status = 200 }: CallOptions = {},
  ) {
    const response = await this.context.fetch("/api" + path, {
      method,
      data,
      headers,
    });
    expect(
      response.status(),
      `${method} ${path}: ${await response.text()}`,
    ).toBe(status);
    return response.status() === 204 ? null : response.json();
  }
  get(path: string, options?: CallOptions) {
    return this.call("GET", path, options);
  }
  post(path: string, data?: unknown, options: CallOptions = {}) {
    return this.call("POST", path, { data, ...options });
  }
  put(path: string, data: unknown, options: CallOptions = {}) {
    return this.call("PUT", path, { data, ...options });
  }
  patch(path: string, data: unknown, options: CallOptions = {}) {
    return this.call("PATCH", path, { data, ...options });
  }
  checkout(
    data: unknown,
    { key = randomUUID(), ...options }: CallOptions & { key?: string } = {},
  ) {
    return this.post("/checkouts", data, {
      status: 201,
      ...options,
      headers: { "Idempotency-Key": key, ...options.headers },
    });
  }
}
