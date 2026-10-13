import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
process.env.DB_PATH = ":memory:";
process.env.WEATHER_TIMEOUT_MS = "80";
const { createApp } = await import("../src/app.js");
const { db, seed } = await import("../src/database.js");
const { config, today } = await import("../src/config.js");
let server,
  base,
  mock,
  mode = "ok";
const date = (offset) => {
  const d = new Date(today() + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
const range = {
  propertyId: 1,
  checkIn: date(10),
  checkOut: date(13),
  guests: 2,
};
async function request(url, { cookie, body, method = "GET" } = {}) {
  const response = await fetch(base + url, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return {
    status: response.status,
    data: response.status === 204 ? null : await response.json(),
    cookie: response.headers.get("set-cookie")?.split(";")[0],
    headers: response.headers,
  };
}
async function login(email) {
  const r = await request("/api/auth/login", {
    method: "POST",
    body: { email, password: "StayFinder123!" },
  });
  assert.equal(r.status, 200);
  return r.cookie;
}
let admin, jamie, taylor;
before(async () => {
  const app = createApp();
  seed();
  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = "http://127.0.0.1:" + server.address().port;
  mock = http.createServer((req, res) => {
    if (mode === "slow") {
      setTimeout(() => res.end("{}"), 250);
      return;
    }
    res.setHeader("Content-Type", "application/json");
    if (mode === "http") {
      res.statusCode = 502;
      res.end("{}");
      return;
    }
    res.end(
      JSON.stringify(
        mode === "bad"
          ? {}
          : {
              current: {
                temperature_2m: 23,
                weather_code: 0,
                wind_speed_10m: 7,
                time: "2030-01-01T12:00",
              },
            },
      ),
    );
  });
  mock.listen(0, "127.0.0.1");
  await new Promise((r) => mock.once("listening", r));
  config.weatherUrl = "http://127.0.0.1:" + mock.address().port;
  admin = await login("admin@stayfinder.demo");
  jamie = await login("jamie@stayfinder.demo");
  taylor = await login("taylor@stayfinder.demo");
});
after(async () => {
  await Promise.all([
    new Promise((r) => server.close(r)),
    new Promise((r) => mock.close(r)),
  ]);
  db.close();
});
test("stage 1: seeded catalog, filters, sort, pagination, validation and session lifecycle", async () => {
  const all = await request("/api/properties?pageSize=50");
  assert.equal(all.data.total, 12);
  assert.equal(db.prepare("SELECT count(*) n FROM users").get().n, 3);
  const filtered = await request(
    "/api/properties?destination=Lisbon&amenities=Pool&guests=4",
  );
  assert.equal(filtered.data.total, 1);
  const sorted = await request("/api/properties?sort=price_desc&pageSize=2");
  assert.equal(sorted.data.items.length, 2);
  assert.ok(
    sorted.data.items[0].price_cents >= sorted.data.items[1].price_cents,
  );
  assert.equal(
    (await request("/api/properties?checkIn=not-a-date")).status,
    400,
  );
  assert.equal((await request("/api/properties/999")).status, 404);
  assert.equal((await request("/api/bookings")).status, 401);
  assert.equal(
    (await request("/api/admin/users", { cookie: jamie })).status,
    403,
  );
  const session = await request("/api/auth/login", {
    method: "POST",
    body: { email: "jamie@stayfinder.demo", password: "StayFinder123!" },
  });
  assert.match(session.headers.get("set-cookie"), /HttpOnly/);
  assert.match(session.headers.get("set-cookie"), /SameSite=Lax/);
  assert.equal(
    (await request("/api/auth/me", { cookie: session.cookie })).data.user.role,
    "customer",
  );
  assert.equal(
    (
      await request("/api/auth/logout", {
        cookie: session.cookie,
        method: "POST",
      })
    ).status,
    204,
  );
  assert.equal(
    (await request("/api/auth/me", { cookie: session.cookie })).data.user,
    null,
  );
  assert.equal(
    (
      await request("/api/auth/login", {
        method: "POST",
        body: { email: "jamie@stayfinder.demo", password: "incorrect" },
      })
    ).data.error.code,
    "INVALID_CREDENTIALS",
  );
});
test("stage 2: server price, competing requests, exclusive checkout, ownership, cancellation and SQL snapshot", async () => {
  const invalid = [
    { ...range, checkIn: date(-1) },
    { ...range, checkOut: range.checkIn },
    { ...range, guests: 0 },
    { ...range, guests: 3 },
    { ...range, checkIn: "2030-02-30" },
  ];
  for (const body of invalid)
    assert.equal(
      (await request("/api/bookings", { cookie: jamie, method: "POST", body }))
        .status,
      400,
    );
  const race = await Promise.all(
    [jamie, taylor].map((cookie) =>
      request("/api/bookings", {
        cookie,
        method: "POST",
        body: { ...range, totalCents: 1 },
      }),
    ),
  );
  assert.deepEqual(race.map((r) => r.status).sort(), [201, 409]);
  const winner = race.find((r) => r.status === 201),
    owner = race[0].status === 201 ? jamie : taylor,
    other = owner === jamie ? taylor : jamie;
  assert.equal(winner.data.total_cents, 33000);
  assert.equal(
    db.prepare("SELECT count(*) n FROM bookings WHERE property_id=1").get().n,
    1,
  );
  assert.equal(
    (
      await request("/api/bookings/" + winner.data.id + "/cancel", {
        cookie: other,
        method: "POST",
      })
    ).status,
    404,
  );
  const next = await request("/api/bookings", {
    cookie: owner,
    method: "POST",
    body: { ...range, checkIn: range.checkOut, checkOut: date(14) },
  });
  assert.equal(next.status, 201);
  db.prepare("UPDATE properties SET price_cents=99900 WHERE id=1").run();
  assert.equal(
    db
      .prepare("SELECT total_cents FROM bookings WHERE id=?")
      .get(winner.data.id).total_cents,
    33000,
  );
  const first = await request("/api/bookings/" + winner.data.id + "/cancel", {
      cookie: owner,
      method: "POST",
    }),
    second = await request("/api/bookings/" + winner.data.id + "/cancel", {
      cookie: owner,
      method: "POST",
    });
  assert.equal(first.status, 200);
  assert.equal(first.data.cancelled_at, second.data.cancelled_at);
  assert.equal(
    (
      await request(
        "/api/properties/1/availability?" + new URLSearchParams(range),
      )
    ).status,
    200,
  );
  const todayBooking = await request("/api/bookings", {
    cookie: owner,
    method: "POST",
    body: { propertyId: 2, checkIn: today(), checkOut: date(1), guests: 2 },
  });
  assert.equal(todayBooking.status, 201);
  assert.equal(
    (
      await request("/api/bookings/" + todayBooking.data.id + "/cancel", {
        cookie: owner,
        method: "POST",
      })
    ).data.error.code,
    "CANCELLATION_CLOSED",
  );
  for (const row of (await request("/api/bookings", { cookie: owner })).data
    .items)
    assert.equal(row.user_id, winner.data.user_id);
});
test("stage 3: admin CRUD, deactivation, unique users and immediate session revocation", async () => {
  const body = {
    name: "QA Cottage",
    destination: "Test City",
    description: "A test accommodation.",
    priceCents: 12300,
    capacity: 4,
    amenities: ["WiFi"],
    images: ["https://example.com/test.jpg"],
    latitude: 1,
    longitude: 2,
    active: true,
  };
  const created = await request("/api/admin/properties", {
    cookie: admin,
    method: "POST",
    body,
  });
  assert.equal(created.status, 201);
  const id = created.data.id;
  assert.equal(
    (
      await request("/api/bookings", {
        cookie: jamie,
        method: "POST",
        body: { ...range, propertyId: id },
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await request("/api/admin/properties/" + id, {
        cookie: admin,
        method: "PUT",
        body: { ...body, active: false, priceCents: 44400 },
      })
    ).status,
    200,
  );
  assert.equal((await request("/api/properties/" + id)).status, 404);
  assert.equal(
    (
      await request("/api/bookings", {
        cookie: jamie,
        method: "POST",
        body: { ...range, propertyId: id },
      })
    ).status,
    404,
  );
  assert.ok(
    (await request("/api/admin/bookings", { cookie: admin })).data.items.some(
      (b) => b.property_id === id && b.total_cents === 36900,
    ),
  );
  const userBody = {
    name: "QA User",
    email: "qa@example.com",
    password: "Password123!",
    role: "customer",
  };
  assert.equal(
    (
      await request("/api/admin/users", {
        cookie: admin,
        method: "POST",
        body: userBody,
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await request("/api/admin/users", {
        cookie: admin,
        method: "POST",
        body: { ...userBody, email: "QA@example.com" },
      })
    ).data.error.code,
    "EMAIL_EXISTS",
  );
  assert.equal(
    (
      await request("/api/admin/users/1", {
        cookie: admin,
        method: "PATCH",
        body: { role: "customer", active: true },
      })
    ).data.error.code,
    "SELF_LOCKOUT",
  );
  assert.equal(
    (
      await request("/api/admin/users/3", {
        cookie: admin,
        method: "PATCH",
        body: { role: "customer", active: false },
      })
    ).status,
    200,
  );
  assert.equal(
    (await request("/api/bookings", { cookie: taylor })).status,
    401,
  );
});
test("stage 3: weather success, malformed upstream, HTTP error, timeout and booking independence", async () => {
  mode = "ok";
  assert.equal(
    (await request("/api/weather?propertyId=1")).data.temperature,
    23,
  );
  for (const failure of ["bad", "http", "slow"]) {
    mode = failure;
    const r = await request("/api/weather?propertyId=1");
    assert.equal(r.status, 503);
    assert.equal(r.data.error.code, "WEATHER_UNAVAILABLE");
  }
  assert.equal(
    (
      await request("/api/bookings", {
        cookie: jamie,
        method: "POST",
        body: { ...range, propertyId: 4 },
      })
    ).status,
    201,
  );
});
test("stage 4: Swagger contract and SQL overlap enforcement", async () => {
  const r = await request("/api/openapi.json");
  assert.equal(r.data.openapi, "3.0.3");
  assert.ok(r.data.paths["/api/admin/users/{id}"]);
  assert.throws(
    () =>
      db
        .prepare(
          "INSERT INTO bookings(user_id,property_id,check_in,check_out,guests,nights,nightly_price_cents,total_cents) VALUES(2,4,?,?,2,3,100,300)",
        )
        .run(range.checkIn, range.checkOut),
    /BOOKING_CONFLICT/,
  );
});
