import { expect } from "@playwright/test";
import { randomUUID } from "node:crypto";

// HTTP-only helper: it never reads the database or changes provider state.
export class ApiClient {
  constructor(context) {
    this.context = context;
  }
  async call(method, path, { data, headers, status = 200 } = {}) {
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
  get(path, options) {
    return this.call("GET", path, options);
  }
  post(path, data, options = {}) {
    return this.call("POST", path, { data, ...options });
  }
  put(path, data, options = {}) {
    return this.call("PUT", path, { data, ...options });
  }
  patch(path, data, options = {}) {
    return this.call("PATCH", path, { data, ...options });
  }
  checkout(data, { key = randomUUID(), ...options } = {}) {
    return this.post("/checkouts", data, {
      status: 201,
      ...options,
      headers: { "Idempotency-Key": key, ...options.headers },
    });
  }
}
