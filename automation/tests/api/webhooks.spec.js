import { test, expect } from "../../fixtures/test.js";
import { stay } from "../../data/builders.js";

async function webhook(context, event) {
  return context.post("/api/payments/webhook", {
    data: event.payload,
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": event.signature,
    },
  });
}

test("HOOK-01 signed duplicate payment events create exactly one booking @payments @db", async ({
  actors,
  system,
}) => {
  const c = await actors.customer.checkout(stay(system.today));
  system.pay(c.id);
  const session = [...system.stripe.sessions.values()][0];
  const event = system.signedEvent("checkout.session.completed", session);
  expect((await webhook(actors.anonymous.context, event)).status()).toBe(200);
  expect((await webhook(actors.anonymous.context, event)).status()).toBe(200);
  expect(
    system.db.one("SELECT count(*) n FROM bookings WHERE checkout_id=?", c.id)
      .n,
  ).toBe(1);
});

test("HOOK-02 forged signatures and signed live events are rejected @payments", async ({
  actors,
  system,
}) => {
  const event = system.signedEvent("checkout.session.completed", {
    id: "cs_unknown",
  });
  const forged = await webhook(actors.anonymous.context, {
    ...event,
    signature: "invalid",
  });
  expect(forged.status()).toBe(400);
  expect((await forged.json()).error.code).toBe("INVALID_WEBHOOK_SIGNATURE");
  const live = await webhook(
    actors.anonymous.context,
    system.signedEvent(
      "checkout.session.completed",
      { id: "cs_unknown" },
      { livemode: true },
    ),
  );
  expect(live.status()).toBe(400);
  expect((await live.json()).error.code).toBe("LIVE_PAYMENTS_DISABLED");
});
