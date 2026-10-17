import { test, expect } from "../../fixtures/test.js";
import { stay } from "../../data/builders.js";

test("DB-01 migrations, seed, indexes and foreign-key integrity @db @sanity", async ({
  system,
}) => {
  expect(system.db.one("SELECT count(*) n FROM migrations").n).toBe(4);
  expect(system.db.one("SELECT count(*) n FROM users").n).toBe(3);
  expect(system.db.one("SELECT count(*) n FROM properties").n).toBe(12);
  expect(system.db.all("PRAGMA foreign_key_check")).toEqual([]);
  expect(system.db.one("PRAGMA integrity_check").integrity_check).toBe("ok");
  const triggers = system.db
    .all("SELECT name FROM sqlite_master WHERE type='trigger'")
    .map((t) => t.name);
  expect(triggers).toEqual(
    expect.arrayContaining([
      "booking_no_overlap",
      "booking_no_overlap_update",
      "checkout_no_overlap_insert",
      "checkout_no_overlap_update",
    ]),
  );
});

test("DB-02 paid API flow persists relationships, money and cancellation history @db @payments", async ({
  actors,
  system,
}) => {
  const c = await actors.customer.checkout(stay(system.today));
  expect(system.db.one("SELECT count(*) n FROM bookings").n).toBe(0);
  system.pay(c.id);
  const result = await actors.customer.post(`/checkouts/${c.id}/sync`);
  const row = system.db.one(
    `SELECT b.*,u.email,c.status checkout_status FROM bookings b
    JOIN users u ON u.id=b.user_id JOIN checkouts c ON c.id=b.checkout_id WHERE b.id=?`,
    result.booking.id,
  );
  expect(row).toMatchObject({
    email: "jamie@stayfinder.demo",
    checkout_status: "completed",
    total_cents: 33000,
    currency: "USD",
  });
  expect(row.total_cents).toBe(row.nights * row.nightly_price_cents);
  await actors.customer.post(`/bookings/${row.id}/cancel`);
  expect(
    system.db.one(
      "SELECT status,payment_status,cancelled_at FROM bookings WHERE id=?",
      row.id,
    ),
  ).toMatchObject({
    status: "cancelled",
    payment_status: "refunded",
    cancelled_at: expect.any(String),
  });
  expect(system.db.all("PRAGMA foreign_key_check")).toEqual([]);
});

test("DB-03 unique email, foreign keys and money checks reject invalid direct writes @db", async ({
  system,
}) => {
  expect(
    system.probeConstraint(
      "INSERT INTO users(name,email,password_hash,role) VALUES('Duplicate','JAMIE@STAYFINDER.DEMO','not-a-real-password','customer')",
    ).code,
  ).toBe("SQLITE_CONSTRAINT_UNIQUE");
  const insert = `INSERT INTO bookings(user_id,property_id,check_in,check_out,guests,nights,nightly_price_cents,total_cents)
    VALUES(?,1,'2035-01-01','2035-01-03',2,2,11000,?)`;
  expect(system.probeConstraint(insert, 999999, 22000).code).toBe(
    "SQLITE_CONSTRAINT_FOREIGNKEY",
  );
  expect(system.probeConstraint(insert, 2, 1).code).toBe(
    "SQLITE_CONSTRAINT_CHECK",
  );
  expect(system.db.one("SELECT count(*) n FROM bookings").n).toBe(0);
});

test("DB-04 SQL trigger blocks a direct booking that would steal an active hold @db @payments", async ({
  actors,
  system,
}) => {
  const range = stay(system.today);
  await actors.customer.checkout(range);
  const result = system.probeConstraint(
    `INSERT INTO bookings(user_id,property_id,check_in,check_out,guests,nights,nightly_price_cents,total_cents)
    VALUES(3,1,?,?,2,3,11000,33000)`,
    range.checkIn,
    range.checkOut,
  );
  expect(result.message).toContain("BOOKING_CONFLICT");
  expect(system.db.one("SELECT count(*) n FROM bookings").n).toBe(0);
});
