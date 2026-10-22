import { expect, test } from "../../fixtures/test.ts";

test("SAN-01 public API and documentation are healthy @sanity", async ({
  actors,
}) => {
  const api = actors.anonymous;
  expect(await api.get("/health")).toMatchObject({
    status: "ok",
    currency: "USD",
  });
  expect((await api.get("/destinations")).items).toHaveLength(4);
  expect((await api.get("/properties")).total).toBe(12);
  expect(await api.get("/properties/1")).toMatchObject({
    id: 1,
    currency: "USD",
    active: true,
  });
  expect((await api.get("/openapi.json")).openapi).toMatch(/^3\./);
  const docs = await api.context.get("/api/docs/");
  expect(docs.status()).toBe(200);
  expect(await docs.text()).toContain("Swagger UI");
});

test("SAN-02 login, HttpOnly session, identity and logout @sanity", async ({
  actors,
}) => {
  const api = actors.anonymous;
  expect((await api.get("/auth/me")).user).toBeNull();
  const response = await api.context.post("/api/auth/login", {
    data: { email: "jamie@stayfinder.demo", password: "StayFinder123!" },
  });
  expect(response.status()).toBe(200);
  expect(response.headers()["set-cookie"]).toMatch(/HttpOnly/i);
  expect((await api.get("/auth/me")).user).toMatchObject({
    role: "customer",
    email: "jamie@stayfinder.demo",
  });
  expect(JSON.stringify(await api.get("/auth/me"))).not.toContain("password");
  await api.post("/auth/logout", undefined, { status: 204 });
  expect((await api.get("/auth/me")).user).toBeNull();
  await api.get("/bookings", { status: 401 });
});

test("AUTH-01 wrong password and foreign mutation origins are rejected", async ({
  actors,
}) => {
  const bad = await actors.anonymous.post(
    "/auth/login",
    { email: "jamie@stayfinder.demo", password: "wrong-password" },
    { status: 401 },
  );
  expect(bad.error).toMatchObject({
    code: "INVALID_CREDENTIALS",
    message: expect.any(String),
  });
  const foreign = await actors.customer.post("/auth/logout", undefined, {
    status: 403,
    headers: { Origin: "https://untrusted.example" },
  });
  expect(foreign.error.code).toBe("ORIGIN_REJECTED");
});

test("AUTH-02 customer and anonymous users cannot access administrator endpoints", async ({
  actors,
}) => {
  for (const path of ["/admin/properties", "/admin/users", "/admin/bookings"]) {
    const anonymous = await actors.anonymous.get(path, { status: 401 });
    expect(anonymous.error.code).toBe("UNAUTHENTICATED");
    const customer = await actors.customer.get(path, { status: 403 });
    expect(customer.error.code).toBe("FORBIDDEN");
  }
});
