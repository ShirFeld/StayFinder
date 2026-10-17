import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { StripeDouble } from "./stripe-double.js";
process.env.DB_PATH = ":memory:";
const { createApp } = await import("../src/app.js");
const { db, seed } = await import("../src/database.js");
const { config, today } = await import("../src/config.js");
config.stripeWebhookSecret = "whsec_stayfinder_tests_only";
const stripe = new StripeDouble();
let app, server, base, jamie, taylor, admin;
const date = (n) => {
  const d = new Date(today() + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const range = (propertyId = 1, offset = 20) => ({
  propertyId,
  checkIn: date(offset),
  checkOut: date(offset + 3),
  guests: 2,
});
async function request(
  path,
  { cookie = jamie, body, method = "GET", key, raw, signature, origin } = {},
) {
  const res = await fetch(base + path, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(origin ? { Origin: origin } : {}),
      ...(body || raw ? { "Content-Type": "application/json" } : {}),
      ...(key ? { "Idempotency-Key": key } : {}),
      ...(signature ? { "stripe-signature": signature } : {}),
    },
    ...(body || raw ? { body: raw || JSON.stringify(body) } : {}),
  });
  return {
    status: res.status,
    data: res.status === 204 ? null : await res.json(),
    cookie: res.headers.get("set-cookie")?.split(";")[0],
  };
}
async function start(body = range(), cookie = jamie, key = randomUUID()) {
  return request("/api/checkouts", { method: "POST", body, cookie, key });
}
async function sync(id, cookie = jamie) {
  return request("/api/checkouts/" + id + "/sync", { method: "POST", cookie });
}
function pay(id) {
  stripe.pay(
    db.prepare("SELECT stripe_session_id FROM checkouts WHERE id=?").get(id)
      .stripe_session_id,
  );
}
async function paid(body = range()) {
  const c = await start(body);
  assert.equal(c.status, 201);
  pay(c.data.id);
  const result = await sync(c.data.id);
  assert.equal(result.status, 200);
  return result.data;
}
before(async () => {
  app = createApp({ stripe });
  seed();
  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = "http://127.0.0.1:" + server.address().port;
  for (const name of ["jamie", "taylor", "admin"]) {
    const r = await request("/api/auth/login", {
      method: "POST",
      cookie: null,
      body: { email: name + "@stayfinder.demo", password: "StayFinder123!" },
    });
    assert.equal(r.status, 200);
    if (name === "jamie") jamie = r.cookie;
    else if (name === "taylor") taylor = r.cookie;
    else admin = r.cookie;
  }
});
after(async () => {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  db.close();
});

test("direct booking cannot bypass payment; missing credentials and request keys are explicit", async () => {
  assert.equal(
    (await request("/api/bookings", { method: "POST", body: range() })).data
      .error.code,
    "PAYMENT_REQUIRED",
  );
  assert.equal(
    (await request("/api/checkouts", { method: "POST", body: range() })).data
      .error.code,
    "IDEMPOTENCY_KEY_REQUIRED",
  );
  assert.equal((await start(range(), null)).status, 401);
});

test("holds occupy catalog and availability, no booking exists until verified paid, snapshots survive edits", async () => {
  const key = randomUUID();
  const c = await start(range(), jamie, key);
  assert.equal(c.status, 201);
  assert.equal(c.data.status, "open");
  assert.equal(c.data.booking, null);
  assert.equal(c.data.totalCents, 33000);
  assert.equal(db.prepare("SELECT count(*) n FROM bookings").get().n, 0);
  assert.equal(
    (
      await request(
        "/api/properties/1/availability?" + new URLSearchParams(range()),
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await request("/api/properties?" + new URLSearchParams(range()))
    ).data.items.some((p) => p.id === 1),
    false,
  );
  assert.equal((await start(range(), taylor)).status, 409);
  const duplicate = await start(range(), jamie, key);
  assert.equal(duplicate.data.id, c.data.id);
  assert.equal(stripe.createCalls, 1);
  assert.equal(
    (await start({ ...range(), guests: 1 }, jamie, key)).data.error.code,
    "IDEMPOTENCY_CONFLICT",
  );
  assert.equal((await sync(c.data.id)).data.booking, null);
  db.prepare("UPDATE properties SET price_cents=44400 WHERE id=1").run();
  pay(c.data.id);
  const results = await Promise.all([sync(c.data.id), sync(c.data.id)]);
  for (const r of results) {
    assert.equal(r.data.booking.total_cents, 33000);
    assert.equal(r.data.booking.payment_status, "paid");
  }
  assert.equal(
    db
      .prepare("SELECT count(*) n FROM bookings WHERE checkout_id=?")
      .get(c.data.id).n,
    1,
  );
});

test("cancel paid booking issues exactly one full refund, repeats preserve timestamp and ownership", async () => {
  const c = (await request("/api/checkouts")).data.items.find((c) => c.booking);
  const id = c.booking.id;
  assert.equal(
    (
      await request("/api/bookings/" + id + "/cancel", {
        method: "POST",
        cookie: taylor,
      })
    ).status,
    404,
  );
  const first = await request("/api/bookings/" + id + "/cancel", {
    method: "POST",
  });
  assert.equal(first.data.status, "cancelled");
  assert.equal(first.data.payment_status, "refunded");
  const second = await request("/api/bookings/" + id + "/cancel", {
    method: "POST",
  });
  assert.equal(second.data.cancelled_at, first.data.cancelled_at);
  assert.equal(stripe.refundCreates, 1);
  assert.equal(
    (
      await request(
        "/api/properties/1/availability?" + new URLSearchParams(range()),
      )
    ).status,
    200,
  );
});

test("hold creation is atomic for competing requests and checkout data is owner-only", async () => {
  const r = await Promise.all([start(range(2)), start(range(2), taylor)]);
  assert.deepEqual(r.map((x) => x.status).sort(), [201, 409]);
  const index = r.findIndex((x) => x.status === 201),
    c = r[index].data,
    owner = index === 0 ? jamie : taylor,
    other = index === 0 ? taylor : jamie;
  for (const suffix of ["", "/sync", "/cancel"])
    assert.equal(
      (
        await request("/api/checkouts/" + c.id + suffix, {
          method: suffix ? "POST" : "GET",
          cookie: other,
        })
      ).status,
      404,
    );
  assert.equal(
    (
      await request("/api/checkouts/" + c.id + "/cancel", {
        method: "POST",
        cookie: owner,
      })
    ).data.status,
    "cancelled",
  );
  assert.equal(
    (
      await request(
        "/api/properties/2/availability?" + new URLSearchParams(range(2)),
      )
    ).status,
    200,
  );
});

test("expired abandoned checkout releases dates; late paid checkout is refunded without stealing another hold", async () => {
  const c = (await start(range(3))).data;
  const sessionId = db
    .prepare("SELECT stripe_session_id FROM checkouts WHERE id=?")
    .get(c.id).stripe_session_id;
  db.prepare("UPDATE checkouts SET expires_at=unixepoch()-1 WHERE id=?").run(
    c.id,
  );
  assert.equal(
    (await request("/api/checkouts/" + c.id)).data.status,
    "expired",
  );
  const other = await start(range(3), taylor);
  assert.equal(other.status, 201);
  stripe.pay(sessionId);
  const late = await sync(c.id);
  assert.equal(late.data.status, "refunded");
  assert.equal(late.data.booking, null);
  assert.equal(
    (await request("/api/checkouts/" + other.data.id, { cookie: taylor })).data
      .status,
    "open",
  );
});

test("uncertain checkout creation remains recoverable with same provider idempotency key", async () => {
  stripe.createTimeoutOnce = true;
  const key = randomUUID();
  const failed = await start(range(4), jamie, key);
  assert.equal(failed.status, 503);
  const c = db.prepare("SELECT * FROM checkouts WHERE request_key=?").get(key);
  assert.equal(c.status, "creating");
  const before = stripe.createCalls;
  const retry = await start(range(4), jamie, key);
  assert.equal(retry.status, 201);
  assert.equal(retry.data.id, c.id);
  assert.equal(stripe.createCalls, before);
});

test("network failure while cancelling does not free a still-payable hold; retry safely expires provider session", async () => {
  const c = (await start(range(5))).data;
  stripe.unavailable = true;
  assert.equal(
    (await request("/api/checkouts/" + c.id + "/cancel", { method: "POST" }))
      .status,
    503,
  );
  assert.equal((await start(range(5), taylor)).status, 409);
  stripe.unavailable = false;
  assert.equal(
    (await request("/api/checkouts/" + c.id + "/cancel", { method: "POST" }))
      .data.status,
    "cancelled",
  );
});

test("payment racing checkout cancellation is refunded instead of creating a booking", async () => {
  const c = (await start(range(6))).data;
  stripe.expireRace = true;
  const result = await request("/api/checkouts/" + c.id + "/cancel", {
    method: "POST",
  });
  assert.equal(result.data.status, "refunded");
  assert.equal(result.data.booking, null);
});

test("refund outage persists cancellation, releases availability and retries after restart/reconciliation", async () => {
  const c = await paid(range(7));
  stripe.refundUnavailable = true;
  const result = await request("/api/bookings/" + c.booking.id + "/cancel", {
    method: "POST",
  });
  assert.equal(result.status, 200);
  assert.equal(result.data.status, "cancelled");
  assert.equal(result.data.payment_status, "refund_pending");
  assert.equal(
    (
      await request(
        "/api/properties/7/availability?" + new URLSearchParams(range(7)),
      )
    ).status,
    200,
  );
  stripe.refundUnavailable = false;
  await app.locals.payments.reconcile();
  assert.equal(
    (await request("/api/checkouts/" + c.id)).data.booking.payment_status,
    "refunded",
  );
});

test("provider pending and failed refunds are not reported as completed; explicit retry uses a new attempt", async () => {
  stripe.refundStatus = "pending";
  const c = await paid(range(8));
  const r = await request("/api/bookings/" + c.booking.id + "/cancel", {
    method: "POST",
  });
  assert.equal(r.data.payment_status, "refund_pending");
  stripe.refundsById.get(r.data.refund_id).status = "succeeded";
  await sync(c.id);
  assert.equal(
    (await request("/api/checkouts/" + c.id)).data.booking.payment_status,
    "refunded",
  );
  stripe.refundStatus = "failed";
  const d = await paid(range(9));
  const failed = await request("/api/bookings/" + d.booking.id + "/cancel", {
    method: "POST",
  });
  assert.equal(failed.data.payment_status, "refund_failed");
  stripe.refundStatus = "succeeded";
  const retry = await request("/api/bookings/" + d.booking.id + "/cancel", {
    method: "POST",
  });
  assert.equal(retry.data.payment_status, "refunded");
});

test("signed webhooks confirm payments once even without browser return; forged/live events are rejected", async () => {
  const c = (await start(range(10))).data;
  pay(c.id);
  const row = db
    .prepare("SELECT stripe_session_id FROM checkouts WHERE id=?")
    .get(c.id);
  const event = {
    id: "evt_test_paid",
    type: "checkout.session.completed",
    livemode: false,
    data: { object: stripe.sessions.get(row.stripe_session_id) },
  };
  async function deliver(e, signature) {
    const raw = JSON.stringify(e);
    return request("/api/payments/webhook", {
      method: "POST",
      cookie: null,
      raw,
      signature:
        signature ||
        stripe.webhooks.generateTestHeaderString({
          payload: raw,
          secret: config.stripeWebhookSecret,
        }),
    });
  }
  assert.equal((await deliver(event, "bad-signature")).status, 400);
  assert.equal((await deliver({ ...event, livemode: true })).status, 400);
  assert.equal((await deliver(event)).status, 200);
  assert.equal((await deliver(event)).status, 200);
  assert.equal(
    db.prepare("SELECT count(*) n FROM bookings WHERE checkout_id=?").get(c.id)
      .n,
    1,
  );
});

test("provider totals cannot be forged, and deactivation after holding triggers a full refund", async () => {
  const c = (await start(range(11))).data;
  pay(c.id);
  const s = stripe.sessions.get(
    db.prepare("SELECT stripe_session_id FROM checkouts WHERE id=?").get(c.id)
      .stripe_session_id,
  );
  s.amount_total++;
  assert.equal(
    (await sync(c.id)).data.error.code,
    "PAYMENT_VERIFICATION_FAILED",
  );
  assert.equal(
    db.prepare("SELECT count(*) n FROM bookings WHERE checkout_id=?").get(c.id)
      .n,
    0,
  );
  s.amount_total--;
  db.prepare("UPDATE properties SET active=0 WHERE id=11").run();
  assert.equal((await sync(c.id)).data.status, "refunded");
});

test("same-day booking cannot be cancelled, while old unpaid bookings remain supported", async () => {
  const c = await paid(range(12, 0));
  assert.equal(
    (
      await request("/api/bookings/" + c.booking.id + "/cancel", {
        method: "POST",
      })
    ).data.error.code,
    "CANCELLATION_CLOSED",
  );
  const result = db
    .prepare(
      "INSERT INTO bookings(user_id,property_id,check_in,check_out,guests,nights,nightly_price_cents,total_cents) VALUES(2,12,?,?,2,3,100,300)",
    )
    .run(date(200), date(203));
  const cancelled = await request(
    "/api/bookings/" + result.lastInsertRowid + "/cancel",
    { method: "POST" },
  );
  assert.equal(cancelled.data.payment_status, "legacy");
  assert.equal(cancelled.data.status, "cancelled");
});

test("checkout callback origin is immutable across an uncertain request and configuration change", async () => {
  const old = config.checkoutOrigin,
    key = randomUUID();
  stripe.createTimeoutOnce = true;
  const first = await start(range(2, 300), jamie, key);
  assert.equal(first.status, 503);
  config.checkoutOrigin = "http://localhost:3999";
  try {
    const retry = await start(range(2, 300), jamie, key);
    assert.equal(retry.status, 201);
    assert.equal(
      db
        .prepare("SELECT return_origin FROM checkouts WHERE id=?")
        .get(retry.data.id).return_origin,
      old,
    );
  } finally {
    config.checkoutOrigin = old;
  }
});

test("disabled holder or reduced capacity is refunded rather than confirming an invalid booking", async () => {
  const c = (await start(range(3, 300), taylor)).data;
  db.prepare("UPDATE users SET active=0 WHERE id=3").run();
  pay(c.id);
  await app.locals.payments.synchronize(c.id);
  assert.equal(
    db.prepare("SELECT status FROM checkouts WHERE id=?").get(c.id).status,
    "refunded",
  );
  db.prepare("UPDATE users SET active=1 WHERE id=3").run();
  const d = (await start(range(4, 300))).data;
  db.prepare("UPDATE properties SET capacity=1 WHERE id=4").run();
  pay(d.id);
  assert.equal((await sync(d.id)).data.status, "refunded");
});

test("SQL triggers prevent direct bookings from stealing holds and updates from reactivating conflicts", async () => {
  const c = (await start(range(5, 300))).data;
  assert.throws(
    () =>
      db
        .prepare(
          "INSERT INTO bookings(user_id,property_id,check_in,check_out,guests,nights,nightly_price_cents,total_cents) VALUES(2,5,?,?,2,3,100,300)",
        )
        .run(c.checkIn, c.checkOut),
    /BOOKING_CONFLICT/,
  );
  await request("/api/checkouts/" + c.id + "/cancel", { method: "POST" });
  const d = await start(range(5, 300), taylor);
  assert.equal(d.status, 201);
  assert.throws(
    () =>
      db
        .prepare(
          "UPDATE checkouts SET status='open',expires_at=unixepoch()+1800 WHERE id=?",
        )
        .run(c.id),
    /BOOKING_CONFLICT/,
  );
});

test("unconfigured checkout returns an actionable error instead of creating an unpaid booking", async () => {
  const old = config.stripeSecretKey;
  config.stripeSecretKey = "";
  const unconfigured = createApp();
  config.stripeSecretKey = old;
  const other = unconfigured.listen(0, "127.0.0.1");
  await new Promise((r) => other.once("listening", r));
  try {
    const res = await fetch(
      "http://127.0.0.1:" + other.address().port + "/api/checkouts",
      {
        method: "POST",
        headers: {
          Cookie: jamie,
          "Content-Type": "application/json",
          "Idempotency-Key": randomUUID(),
        },
        body: JSON.stringify(range(6, 300)),
      },
    );
    assert.equal(res.status, 503);
    assert.equal((await res.json()).error.code, "PAYMENTS_NOT_CONFIGURED");
  } finally {
    other.closeAllConnections();
    await new Promise((r) => other.close(r));
  }
});

test("a saved checkout cancellation is completed by background reconciliation after an outage", async () => {
  for (const c of db
    .prepare(
      "SELECT id,user_id FROM checkouts WHERE status IN ('creating','open')",
    )
    .all())
    await request("/api/checkouts/" + c.id + "/cancel", {
      method: "POST",
      cookie: c.user_id === 2 ? jamie : taylor,
    });
  const c = (await start(range(1, 400))).data;
  stripe.unavailable = true;
  assert.equal(
    (await request("/api/checkouts/" + c.id + "/cancel", { method: "POST" }))
      .status,
    503,
  );
  assert.equal(
    db.prepare("SELECT cancel_requested FROM checkouts WHERE id=?").get(c.id)
      .cancel_requested,
    1,
  );
  stripe.unavailable = false;
  await app.locals.payments.reconcile();
  assert.equal(
    (await request("/api/checkouts/" + c.id)).data.status,
    "cancelled",
  );
  assert.equal(
    (
      await request(
        "/api/properties/1/availability?" + new URLSearchParams(range(1, 400)),
      )
    ).status,
    200,
  );
});

test("failed late-payment refunds without a booking are visible and can be retried exactly once", async () => {
  const c = (await start(range(2, 400))).data;
  db.prepare("UPDATE checkouts SET expires_at=unixepoch()-1 WHERE id=?").run(
    c.id,
  );
  pay(c.id);
  stripe.refundStatus = "failed";
  const failed = await sync(c.id);
  assert.equal(failed.data.booking, null);
  assert.equal(failed.data.refundStatus, "failed");
  assert.equal(failed.data.status, "refund_pending");
  assert.equal(
    (
      await request("/api/checkouts/" + c.id + "/refund", {
        cookie: taylor,
        method: "POST",
      })
    ).status,
    404,
  );
  stripe.refundStatus = "succeeded";
  const retry = await request("/api/checkouts/" + c.id + "/refund", {
    method: "POST",
  });
  assert.equal(retry.data.refundStatus, "succeeded");
  assert.equal(retry.data.status, "refunded");
  const count = stripe.refundCreates;
  assert.equal(
    (await request("/api/checkouts/" + c.id + "/refund", { method: "POST" }))
      .data.status,
    "refunded",
  );
  assert.equal(stripe.refundCreates, count);
});

test("an expired local hold explicitly distinguishes unverified payment from provider-confirmed expiry", async () => {
  const c = (await start(range(3, 400))).data;
  db.prepare("UPDATE checkouts SET expires_at=unixepoch()-1 WHERE id=?").run(
    c.id,
  );
  const local = (await request("/api/checkouts/" + c.id)).data;
  assert.equal(local.status, "expired");
  assert.equal(local.verificationPending, true);
  assert.ok(Math.abs(local.serverTime - Math.floor(Date.now() / 1000)) <= 1);
  const sid = db
    .prepare("SELECT stripe_session_id FROM checkouts WHERE id=?")
    .get(c.id).stripe_session_id;
  stripe.sessions.get(sid).status = "expired";
  const verified = (await sync(c.id)).data;
  assert.equal(verified.status, "expired");
  assert.equal(verified.verificationPending, false);
  assert.equal(verified.booking, null);
});

test("only configured loopback aliases are accepted and the trusted browser origin is saved for return", async () => {
  for (const [propertyId, origin] of [
    [6, "http://localhost:5173"],
    [7, "http://127.0.0.1:5173"],
  ]) {
    const r = await request("/api/checkouts", {
      method: "POST",
      body: range(propertyId, 600),
      key: randomUUID(),
      origin,
    });
    assert.equal(r.status, 201);
    assert.equal(
      db
        .prepare("SELECT return_origin FROM checkouts WHERE id=?")
        .get(r.data.id).return_origin,
      origin,
    );
  }
  for (const origin of ["https://example.com", "http://localhost:9999"]) {
    const r = await request("/api/checkouts", {
      method: "POST",
      body: range(8, 600),
      key: randomUUID(),
      origin,
    });
    assert.equal(r.status, 403);
    assert.equal(r.data.error.code, "ORIGIN_REJECTED");
  }
});
