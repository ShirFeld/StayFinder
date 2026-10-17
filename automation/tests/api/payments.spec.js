import { test, expect } from "../../fixtures/test.js";
import { stay, dateAfter, propertyData } from "../../data/builders.js";
import { randomUUID } from "node:crypto";

test("PAY-01 unpaid checkout never creates a booking; cancellation frees dates @payments @sanity", async ({
  actors,
  system,
}) => {
  const range = stay(system.today);
  const checkout = await actors.customer.checkout(range);
  expect(checkout).toMatchObject({
    status: "open",
    booking: null,
    totalCents: 33000,
  });
  expect(
    (await actors.customer.get("/checkouts")).items.map((c) => c.id),
  ).toContain(checkout.id);
  expect(await actors.customer.get("/checkouts/" + checkout.id)).toMatchObject({
    id: checkout.id,
    booking: null,
  });
  expect((await actors.customer.get("/bookings")).items).toEqual([]);
  await actors.anonymous.get(
    "/properties/1/availability?" + new URLSearchParams(range),
    { status: 409 },
  );
  expect(
    (await actors.customer.post(`/checkouts/${checkout.id}/cancel`)).status,
  ).toBe("cancelled");
  await actors.anonymous.get(
    "/properties/1/availability?" + new URLSearchParams(range),
  );
});

test("PAY-02 verified payment creates one booking with immutable price; repeat sync is safe @payments @db @sanity", async ({
  actors,
  system,
}) => {
  const c = await actors.customer.checkout(stay(system.today));
  const p = await actors.admin.get("/properties/1");
  await actors.admin.put(
    "/admin/properties/1",
    propertyData({ ...p, priceCents: 55500 }),
  );
  system.pay(c.id);
  const results = await Promise.all([
    actors.customer.post(`/checkouts/${c.id}/sync`),
    actors.customer.post(`/checkouts/${c.id}/sync`),
  ]);
  for (const result of results)
    expect(result.booking).toMatchObject({
      status: "confirmed",
      payment_status: "paid",
      total_cents: 33000,
    });
  expect(
    system.db.one("SELECT count(*) n FROM bookings WHERE checkout_id=?", c.id)
      .n,
  ).toBe(1);
  expect((await actors.customer.get("/bookings")).items).toHaveLength(1);
  expect((await actors.admin.get("/admin/bookings")).items).toHaveLength(1);
});

test("PAY-03 idempotency key prevents duplicate provider sessions and rejects changed payload @payments", async ({
  actors,
  system,
}) => {
  const key = randomUUID(),
    range = stay(system.today);
  const first = await actors.customer.checkout(range, { key });
  const retry = await actors.customer.checkout(range, { key });
  expect(retry.id).toBe(first.id);
  expect(system.stripe.createCalls).toBe(1);
  const conflict = await actors.customer.checkout(
    { ...range, guests: 1 },
    { key, status: 409 },
  );
  expect(conflict.error.code).toBe("IDEMPOTENCY_CONFLICT");
  await actors.customer.post("/checkouts", range, { status: 400 });
});

test("PAY-04 concurrent customers cannot hold the same unit @payments @db", async ({
  actors,
  system,
}) => {
  const results = await Promise.all(
    [actors.customer, actors.other].map((actor) =>
      actor.context.post("/api/checkouts", {
        data: stay(system.today),
        headers: { "Idempotency-Key": randomUUID() },
      }),
    ),
  );
  expect(results.map((r) => r.status()).sort()).toEqual([201, 409]);
  expect(system.db.one("SELECT count(*) n FROM checkouts").n).toBe(1);
});

test("PAY-05 checkout and booking ownership are enforced @payments", async ({
  actors,
  system,
}) => {
  const c = await actors.customer.checkout(stay(system.today));
  for (const suffix of ["", "/sync", "/cancel", "/refund"]) {
    const result = suffix
      ? await actors.other.post(`/checkouts/${c.id}${suffix}`, undefined, {
          status: 404,
        })
      : await actors.other.get(`/checkouts/${c.id}`, { status: 404 });
    expect(result.error.code).toBe("NOT_FOUND");
  }
  expect((await actors.other.get("/checkouts")).items).toEqual([]);
  system.pay(c.id);
  const paid = await actors.customer.post(`/checkouts/${c.id}/sync`);
  await actors.other.post(`/bookings/${paid.booking.id}/cancel`, undefined, {
    status: 404,
  });
  expect((await actors.other.get("/bookings")).items).toEqual([]);
});

test("PAY-06 cancellation fully refunds once and releases availability @payments @db", async ({
  actors,
  system,
}) => {
  const range = stay(system.today),
    c = await actors.customer.checkout(range);
  system.pay(c.id);
  const paid = await actors.customer.post(`/checkouts/${c.id}/sync`);
  const first = await actors.customer.post(
    `/bookings/${paid.booking.id}/cancel`,
  );
  const second = await actors.customer.post(
    `/bookings/${paid.booking.id}/cancel`,
  );
  expect(first).toMatchObject({
    status: "cancelled",
    payment_status: "refunded",
  });
  expect(second.cancelled_at).toBe(first.cancelled_at);
  expect(system.stripe.refundCreates).toBe(1);
  expect([...system.stripe.refundsById.values()][0].amount).toBe(33000);
  await actors.anonymous.get(
    "/properties/1/availability?" + new URLSearchParams(range),
  );
});

test("PAY-07 refund outage persists intent and explicit retry completes full refund @payments", async ({
  actors,
  system,
}) => {
  const c = await actors.customer.checkout(stay(system.today));
  system.pay(c.id);
  const paid = await actors.customer.post(`/checkouts/${c.id}/sync`);
  system.stripe.refundUnavailable = true;
  const cancelled = await actors.customer.post(
    `/bookings/${paid.booking.id}/cancel`,
  );
  expect(cancelled.payment_status).toBe("refund_pending");
  system.stripe.refundUnavailable = false;
  const retried = await actors.customer.post(`/checkouts/${c.id}/refund`);
  expect(retried.status).toBe("refunded");
  expect(retried.refundStatus).toBe("succeeded");
});

test("PAY-08 expired hold frees inventory; late payment is refunded @payments", async ({
  actors,
  system,
}) => {
  const range = stay(system.today),
    c = await actors.customer.checkout(range);
  system.expire(c.id);
  expect((await actors.customer.post(`/checkouts/${c.id}/sync`)).status).toBe(
    "expired",
  );
  const replacement = await actors.other.checkout(range);
  system.pay(c.id);
  expect((await actors.customer.post(`/checkouts/${c.id}/sync`)).status).toBe(
    "refunded",
  );
  expect((await actors.customer.get("/bookings")).items).toEqual([]);
  expect((await actors.other.get(`/checkouts/${replacement.id}`)).status).toBe(
    "open",
  );
});

test("PAY-09 provider timeout after acceptance recovers with same idempotency key @payments", async ({
  actors,
  system,
}) => {
  const key = randomUUID(),
    range = stay(system.today);
  system.stripe.createTimeoutOnce = true;
  await actors.customer.checkout(range, { key, status: 503 });
  const recovered = await actors.customer.checkout(range, { key });
  expect(recovered.status).toBe("open");
  expect(system.stripe.createCalls).toBe(1);
});

test("PAY-10 adjacent bookings are allowed and same-day cancellation is rejected @payments", async ({
  actors,
  system,
}) => {
  const firstRange = stay(system.today, {
    checkIn: system.today,
    checkOut: dateAfter(system.today, 2),
  });
  const c = await actors.customer.checkout(firstRange);
  system.pay(c.id);
  const paid = await actors.customer.post(`/checkouts/${c.id}/sync`);
  await actors.customer.post(`/bookings/${paid.booking.id}/cancel`, undefined, {
    status: 409,
  });
  const adjacent = stay(system.today, {
    checkIn: firstRange.checkOut,
    checkOut: dateAfter(system.today, 4),
  });
  await actors.other.checkout(adjacent);
});

test("PAY-11 direct booking cannot bypass checkout or authentication @payments", async ({
  actors,
  system,
}) => {
  expect(
    (
      await actors.customer.post("/bookings", stay(system.today), {
        status: 409,
      })
    ).error.code,
  ).toBe("PAYMENT_REQUIRED");
  await actors.anonymous.post("/bookings", stay(system.today), { status: 401 });
  await actors.anonymous.checkout(stay(system.today), { status: 401 });
});

test("PAY-12 cancellation outage keeps hold until reconciliation confirms expiry @payments", async ({
  actors,
  system,
}) => {
  const range = stay(system.today),
    c = await actors.customer.checkout(range);
  system.stripe.unavailable = true;
  await actors.customer.post(`/checkouts/${c.id}/cancel`, undefined, {
    status: 503,
  });
  await actors.other.checkout(range, { status: 409 });
  system.stripe.unavailable = false;
  await system.reconcile();
  expect((await actors.customer.get(`/checkouts/${c.id}`)).status).toBe(
    "cancelled",
  );
  await actors.other.checkout(range);
});

test("PAY-13 payment racing cancellation is refunded without a booking @payments", async ({
  actors,
  system,
}) => {
  const c = await actors.customer.checkout(stay(system.today));
  system.stripe.expireRace = true;
  const result = await actors.customer.post(`/checkouts/${c.id}/cancel`);
  expect(result).toMatchObject({ status: "refunded", booking: null });
  expect((await actors.customer.get("/bookings")).items).toEqual([]);
});

test("PAY-14 disabled listing after payment hold triggers full refund @payments", async ({
  actors,
  system,
}) => {
  const c = await actors.customer.checkout(stay(system.today));
  const listing = await actors.admin.get("/properties/1");
  await actors.admin.put(
    "/admin/properties/1",
    propertyData({
      ...listing,
      priceCents: listing.price_cents,
      active: false,
    }),
  );
  system.pay(c.id);
  expect((await actors.customer.post(`/checkouts/${c.id}/sync`)).status).toBe(
    "refunded",
  );
  expect((await actors.customer.get("/bookings")).items).toEqual([]);
  expect([...system.stripe.refundsById.values()][0].amount).toBe(33000);
});

test("PAY-15 a failed provider refund can be retried without duplicate success @payments", async ({
  actors,
  system,
}) => {
  const c = await actors.customer.checkout(stay(system.today));
  system.pay(c.id);
  const paid = await actors.customer.post(`/checkouts/${c.id}/sync`);
  system.stripe.refundStatus = "failed";
  expect(
    (await actors.customer.post(`/bookings/${paid.booking.id}/cancel`))
      .payment_status,
  ).toBe("refund_failed");
  system.stripe.refundStatus = "succeeded";
  expect((await actors.customer.post(`/checkouts/${c.id}/refund`)).status).toBe(
    "refunded",
  );
  await actors.customer.post(`/checkouts/${c.id}/refund`);
  expect(system.stripe.refundCreates).toBe(2); // One failed attempt, one successful attempt.
});
