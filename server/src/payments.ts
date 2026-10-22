import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { config, today } from "./config.ts";
import { db } from "./database.ts";
import type { BookingRow, CheckoutRow, PropertyRow, UserRow } from "./types.ts";

const now = () => Math.floor(Date.now() / 1000);
const objectId = (value: string | { id: string } | null | undefined) =>
  typeof value === "string" ? value : value?.id;

// All Stripe operations use test credentials. Tests inject a controlled SDK double.
export function createPayments({
  stripe,
  quote,
  integer,
  fail: providedFail,
  bookingSelect,
  bookingOut,
}: import("./types.ts").PaymentOptions) {
  const fail: import("./types.ts").Fail = providedFail;
  const client =
    stripe ||
    (config.stripeSecretKey
      ? new Stripe(config.stripeSecretKey, {
          timeout: 10000,
          maxNetworkRetries: 1,
        })
      : null);
  const configured = () => {
    if (!client)
      fail(
        503,
        "PAYMENTS_NOT_CONFIGURED",
        "Test payments are not configured yet. Please try again later.",
      );
    return client!;
  };
  const get = (id: string) =>
    db
      .prepare<unknown[], CheckoutRow>("SELECT * FROM checkouts WHERE id=?")
      .get(id)!;
  const owner = (id: string, userId: number) => {
    const c = get(id);
    if (!c || c.user_id !== userId)
      fail(404, "NOT_FOUND", "Checkout not found.");
    return c;
  };
  const booking = (id: string) => {
    const b = db
      .prepare<unknown[], BookingRow>(bookingSelect + " WHERE b.checkout_id=?")
      .get(id)!;
    return b ? bookingOut(b) : null;
  };
  const out = (c: CheckoutRow): import("../../shared/types.ts").Checkout => ({
    id: c.id,
    propertyId: c.property_id,
    propertyName: c.property_name,
    checkIn: c.check_in,
    checkOut: c.check_out,
    guests: c.guests,
    nights: c.nights,
    nightlyPriceCents: c.nightly_price_cents,
    totalCents: c.total_cents,
    currency: c.currency,
    status:
      ["creating", "open"].includes(c.status) && c.expires_at <= now()
        ? "expired"
        : c.status,
    expiresAt: c.expires_at,
    serverTime: now(),
    verificationPending:
      ["creating", "open"].includes(c.status) && c.expires_at <= now(),
    refundStatus: c.refund_status,
    checkoutUrl:
      c.expires_at > now() && !c.cancel_requested && c.status === "open"
        ? c.checkout_url
        : null,
    cancellationRequested: !!c.cancel_requested,
    booking: booking(c.id),
  });

  async function ensureSession(c: CheckoutRow) {
    if (c.stripe_session_id) return c;
    const sdk = configured();
    // Fixed expiry, amount and metadata make retries identical after a network timeout.
    try {
      const session = await sdk.checkout.sessions.create(
        {
          mode: "payment",
          allowed_payment_method_types: ["card"],
          locale: "en",
          client_reference_id: c.id,
          customer_email: c.customer_email,
          metadata: { checkoutId: c.id },
          payment_intent_data: { metadata: { checkoutId: c.id } },
          line_items: [
            {
              quantity: c.nights,
              price_data: {
                currency: "usd",
                unit_amount: c.nightly_price_cents,
                product_data: {
                  name: c.property_name,
                  description:
                    c.check_in +
                    " to " +
                    c.check_out +
                    " | " +
                    c.guests +
                    " guests",
                },
              },
            },
          ],
          expires_at: c.stripe_expires_at,
          success_url:
            c.return_origin + "/checkout/" + c.id + "?payment=returned",
          cancel_url:
            c.return_origin + "/checkout/" + c.id + "?payment=cancelled",
        },
        { idempotencyKey: "checkout:" + c.id },
      );
      if (
        session.livemode !== false ||
        !session.id?.startsWith("cs_test_") ||
        !session.url?.startsWith("https://checkout.stripe.com/")
      )
        throw new Error("Unexpected checkout response");
      db.prepare(
        "UPDATE checkouts SET stripe_session_id=?,checkout_url=?,expires_at=?,status='open',last_error=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='creating'",
      ).run(session.id, session.url, session.expires_at, c.id);
      return get(c.id);
    } catch (caught) {
      const error = caught as Error & { code?: string; type?: string };
      // Never release uncertain network requests: Stripe may have created a session.
      const definitive =
        error.type === "StripeInvalidRequestError" ||
        error.type === "StripeAuthenticationError";
      db.prepare(
        "UPDATE checkouts SET last_error='Payment provider unavailable',status=CASE WHEN ? THEN 'failed' ELSE status END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='creating'",
      ).run(definitive ? 1 : 0, c.id);
      fail(
        503,
        "PAYMENT_PROVIDER_UNAVAILABLE",
        "Could not open Stripe Checkout. Your checkout is saved; retry from My bookings.",
      );
    }
  }

  async function start(
    user: UserRow,
    input: import("../../shared/types.ts").BookingInput,
    requestKey: string | undefined,
    returnOrigin: string | undefined,
  ) {
    configured();
    if (
      typeof requestKey !== "string" ||
      !/^[A-Za-z0-9_-]{16,100}$/.test(requestKey)
    )
      fail(
        400,
        "IDEMPOTENCY_KEY_REQUIRED",
        "Provide an Idempotency-Key header containing 16 to 100 letters, digits, underscores or hyphens.",
      );
    let c = db
      .transaction(() => {
        const existing = db
          .prepare<unknown[], CheckoutRow>(
            "SELECT * FROM checkouts WHERE user_id=? AND request_key=?",
          )
          .get(user.id, requestKey)!;
        if (existing) {
          if (
            existing.property_id !== Number(input.propertyId) ||
            existing.check_in !== input.checkIn ||
            existing.check_out !== input.checkOut ||
            existing.guests !== Number(input.guests)
          )
            fail(
              409,
              "IDEMPOTENCY_CONFLICT",
              "This request key was already used for different dates or guests.",
            );
          return existing;
        }
        if (
          db
            .prepare<unknown[], { n: number }>(
              "SELECT count(*) n FROM checkouts WHERE user_id=? AND status IN ('creating','open') AND expires_at>?",
            )
            .get(user.id, now())!.n >= 5
        )
          fail(
            409,
            "CHECKOUT_LIMIT",
            "Finish or cancel an existing checkout before starting another.",
          );
        const q = quote(input);
        if (q.totalCents < 50 || q.totalCents > 99999999)
          fail(
            400,
            "PAYMENT_AMOUNT_UNSUPPORTED",
            "The stay total must be between $0.50 and $999,999.99 for card checkout.",
          );
        const p = db
          .prepare<unknown[], PropertyRow>(
            "SELECT name FROM properties WHERE id=?",
          )
          .get(q.propertyId)!;
        const id = randomUUID(),
          expiry = now() + 31 * 60;
        db.prepare(
          "INSERT INTO checkouts(id,user_id,property_id,request_key,check_in,check_out,guests,nights,nightly_price_cents,total_cents,property_name,customer_email,expires_at,stripe_expires_at,return_origin) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        ).run(
          id,
          user.id,
          q.propertyId,
          requestKey,
          q.checkIn,
          q.checkOut,
          q.guests,
          q.nights,
          q.nightlyPriceCents,
          q.totalCents,
          p.name,
          user.email,
          expiry + 60,
          expiry,
          returnOrigin || config.checkoutOrigin,
        );
        return get(id);
      })
      .immediate();
    if (c.status === "creating") c = await ensureSession(c);
    return out(c);
  }

  async function refund(c: CheckoutRow) {
    if (!c.payment_intent_id)
      fail(
        502,
        "PAYMENT_VERIFICATION_FAILED",
        "The payment reference is unavailable. Please retry.",
      );
    try {
      const sdk = configured();
      const r = c.refund_id
        ? await sdk.refunds.retrieve(c.refund_id)
        : await sdk.refunds.create(
            {
              payment_intent: c.payment_intent_id,
              metadata: { checkoutId: c.id },
            },
            { idempotencyKey: "refund:" + c.id + ":" + c.refund_attempt },
          );
      if (
        objectId(r.payment_intent) !== c.payment_intent_id ||
        r.amount !== c.total_cents ||
        r.currency !== "usd"
      )
        throw new Error("Refund does not match payment");
      const state =
        r.status === "succeeded"
          ? "refunded"
          : ["failed", "canceled"].includes(r.status || "")
            ? "refund_failed"
            : "refund_pending";
      db.transaction(() => {
        if (
          get(c.id).status === "refunded" ||
          get(c.id).refund_attempt !== c.refund_attempt
        )
          return;
        db.prepare(
          "UPDATE checkouts SET refund_id=?,status=?,refund_status=?,last_error=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
        ).run(
          r.id,
          state === "refunded" ? "refunded" : "refund_pending",
          state === "refunded"
            ? "succeeded"
            : state === "refund_failed"
              ? "failed"
              : "pending",
          state === "refund_failed"
            ? "Refund failed; retry cancellation"
            : null,
          c.id,
        );
        db.prepare(
          "UPDATE bookings SET refund_id=?,payment_status=? WHERE checkout_id=?",
        ).run(r.id, state, c.id);
      }).immediate();
    } catch (caught) {
      const error = caught as Error & { code?: string; type?: string };
      if (error.code === "PAYMENTS_NOT_CONFIGURED") throw error;
      // Cancellation and refund intent are durable even if Stripe is unavailable.
      db.prepare(
        "UPDATE checkouts SET last_error='Refund is awaiting provider confirmation',updated_at=CURRENT_TIMESTAMP WHERE id=?",
      ).run(c.id);
    }
    return out(get(c.id));
  }

  function verify(c: CheckoutRow, s: import("./types.ts").PaymentSession) {
    if (
      s.id !== c.stripe_session_id ||
      s.livemode !== false ||
      s.mode !== "payment" ||
      s.client_reference_id !== c.id ||
      s.metadata?.checkoutId !== c.id ||
      s.currency !== "usd" ||
      s.amount_total !== c.total_cents
    )
      fail(
        502,
        "PAYMENT_VERIFICATION_FAILED",
        "Stripe payment details do not match this checkout.",
      );
  }

  async function synchronize(id: string) {
    let c = get(id);
    if (!c) return null;
    if (c.status === "refunded") return out(c);
    if (c.status === "refund_pending") return refund(c);
    if (c.status === "completed") return out(c);
    if (c.status === "creating") c = await ensureSession(c);
    if (!c.stripe_session_id) return out(c);
    let s;
    try {
      s = await configured().checkout.sessions.retrieve(c.stripe_session_id);
    } catch {
      fail(
        503,
        "PAYMENT_PROVIDER_UNAVAILABLE",
        "Payment status is temporarily unavailable. Please retry; do not start another payment.",
      );
    }
    verify(c, s);
    // A cancellation intent survives network failures and is retried by reconciliation.
    if (c.cancel_requested && s.status === "open") {
      try {
        await configured().checkout.sessions.expire(c.stripe_session_id);
      } catch {}
      try {
        s = await configured().checkout.sessions.retrieve(c.stripe_session_id);
      } catch {
        fail(
          503,
          "PAYMENT_PROVIDER_UNAVAILABLE",
          "Your cancellation is saved. We are waiting for Stripe before releasing the dates.",
        );
      }
      verify(c, s);
    }
    if (s.payment_status === "paid" && s.status === "complete") {
      const paymentIntent = objectId(s.payment_intent);
      if (!paymentIntent)
        fail(
          502,
          "PAYMENT_VERIFICATION_FAILED",
          "Stripe has not provided a payment reference yet.",
        );
      c = db
        .transaction(() => {
          const fresh = get(id);
          if (
            ["completed", "refunded", "refund_pending"].includes(fresh.status)
          )
            return fresh;
          const p = db
            .prepare<unknown[], PropertyRow>(
              "SELECT active,capacity FROM properties WHERE id=?",
            )
            .get(fresh.property_id)!;
          const conflict = db
            .prepare<unknown[], BookingRow>(
              "SELECT id FROM bookings WHERE property_id=? AND status='confirmed' AND check_in<? AND check_out>?",
            )
            .get(fresh.property_id, fresh.check_out, fresh.check_in)!;
          const otherHold = db
            .prepare<unknown[], CheckoutRow>(
              "SELECT id FROM checkouts WHERE id<>? AND property_id=? AND status IN ('creating','open') AND expires_at>? AND check_in<? AND check_out>?",
            )
            .get(
              id,
              fresh.property_id,
              now(),
              fresh.check_out,
              fresh.check_in,
            )!;
          if (
            fresh.cancel_requested ||
            fresh.expires_at <= now() ||
            fresh.check_in < today() ||
            !p?.active ||
            fresh.guests > p.capacity ||
            !db
              .prepare<unknown[], UserRow>(
                "SELECT id FROM users WHERE id=? AND active=1",
              )
              .get(fresh.user_id)! ||
            conflict ||
            otherHold ||
            ["cancelled", "expired", "failed"].includes(fresh.status)
          ) {
            db.prepare(
              "UPDATE checkouts SET status='refund_pending',refund_status='pending',payment_intent_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
            ).run(paymentIntent, id);
            return get(id);
          }
          db.prepare(
            "INSERT INTO bookings(user_id,property_id,check_in,check_out,guests,nights,nightly_price_cents,total_cents,checkout_id,payment_status) VALUES(?,?,?,?,?,?,?,?,?,'paid')",
          ).run(
            fresh.user_id,
            fresh.property_id,
            fresh.check_in,
            fresh.check_out,
            fresh.guests,
            fresh.nights,
            fresh.nightly_price_cents,
            fresh.total_cents,
            id,
          );
          db.prepare(
            "UPDATE checkouts SET status='completed',payment_intent_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
          ).run(paymentIntent, id);
          return get(id);
        })
        .immediate();
      return c.status === "refund_pending" ? refund(c) : out(c);
    }
    if (s.status === "expired")
      db.prepare(
        "UPDATE checkouts SET status=CASE WHEN cancel_requested=1 THEN 'cancelled' ELSE 'expired' END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('creating','open')",
      ).run(id);
    db.prepare(
      "UPDATE checkouts SET updated_at=CURRENT_TIMESTAMP WHERE id=?",
    ).run(id);
    return out(get(id));
  }

  async function cancelCheckout(id: string, userId: number) {
    const c = owner(id, userId);
    if (!["creating", "open"].includes(c.status)) return synchronize(id);
    db.prepare(
      "UPDATE checkouts SET cancel_requested=1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('creating','open')",
    ).run(id);
    const ready =
      c.status === "creating" ? await ensureSession(get(id)) : get(id);
    if (ready.stripe_session_id) {
      try {
        await configured().checkout.sessions.expire(ready.stripe_session_id);
      } catch {
        /* A payment may have completed concurrently. Retrieve authoritative state. */
      }
    }
    return synchronize(id);
  }

  async function cancelBooking(id: unknown, userId: number) {
    const b = db
      .transaction(() => {
        const row = db
          .prepare<unknown[], BookingRow>(
            "SELECT * FROM bookings WHERE id=? AND user_id=?",
          )
          .get(integer(id, "Booking ID"), userId)!;
        if (!row) fail(404, "NOT_FOUND", "Booking not found.");
        if (row.status !== "cancelled") {
          if (row.check_in <= today())
            fail(
              409,
              "CANCELLATION_CLOSED",
              "Bookings can only be cancelled before the check-in day.",
            );
          db.prepare(
            "UPDATE bookings SET status='cancelled',cancelled_at=CURRENT_TIMESTAMP,payment_status=CASE WHEN checkout_id IS NULL THEN 'legacy' ELSE 'refund_pending' END WHERE id=?",
          ).run(row.id);
          if (row.checkout_id)
            db.prepare(
              "UPDATE checkouts SET status='refund_pending',refund_status='pending',updated_at=CURRENT_TIMESTAMP WHERE id=?",
            ).run(row.checkout_id);
        } else if (row.payment_status === "refund_failed") {
          db.prepare(
            "UPDATE checkouts SET refund_id=NULL,refund_attempt=refund_attempt+1,refund_status='pending',last_error=NULL WHERE id=?",
          ).run(row.checkout_id);
          db.prepare(
            "UPDATE bookings SET payment_status='refund_pending',refund_id=NULL WHERE id=?",
          ).run(row.id);
        }
        return db
          .prepare<unknown[], BookingRow>("SELECT * FROM bookings WHERE id=?")
          .get(row.id)!;
      })
      .immediate();
    if (b.checkout_id && b.payment_status !== "refunded")
      await refund(get(b.checkout_id));
    return bookingOut(
      db
        .prepare<unknown[], BookingRow>(bookingSelect + " WHERE b.id=?")
        .get(b.id)!,
    );
  }

  async function retryRefund(id: string, userId: number) {
    const c = db
      .transaction(() => {
        const row = owner(id, userId);
        if (row.status === "refunded") return row;
        if (row.status !== "refund_pending")
          fail(
            409,
            "REFUND_NOT_AVAILABLE",
            "No refund is awaiting recovery for this checkout.",
          );
        if (row.refund_status === "failed") {
          db.prepare(
            "UPDATE checkouts SET refund_id=NULL,refund_attempt=refund_attempt+1,refund_status='pending',last_error=NULL WHERE id=?",
          ).run(id);
          db.prepare(
            "UPDATE bookings SET refund_id=NULL,payment_status='refund_pending' WHERE checkout_id=?",
          ).run(id);
        }
        return get(id);
      })
      .immediate();
    return c.status === "refunded" ? out(c) : refund(c);
  }

  async function webhook(
    req: import("express").Request,
    res: import("express").Response,
  ) {
    if (!config.stripeWebhookSecret)
      fail(
        503,
        "WEBHOOK_NOT_CONFIGURED",
        "Stripe webhook signing secret is not configured.",
      );
    let event;
    try {
      event = configured().webhooks.constructEvent(
        req.body,
        req.get("stripe-signature") || "",
        config.stripeWebhookSecret,
      );
    } catch {
      fail(
        400,
        "INVALID_WEBHOOK_SIGNATURE",
        "Invalid Stripe webhook signature.",
      );
    }
    if (event.livemode !== false)
      fail(
        400,
        "LIVE_PAYMENTS_DISABLED",
        "Only sandbox payment events are accepted.",
      );
    const obj = event.data.object as {
      id: string;
      metadata?: Record<string, string>;
    };
    if (
      [
        "checkout.session.completed",
        "checkout.session.expired",
        "checkout.session.async_payment_succeeded",
      ].includes(event.type)
    ) {
      const c = db
        .prepare<unknown[], CheckoutRow>(
          "SELECT * FROM checkouts WHERE stripe_session_id=? OR id=?",
        )
        .get(obj.id, obj.metadata?.checkoutId || "")!;
      if (c) await synchronize(c.id);
    } else if (
      ["refund.updated", "refund.failed", "charge.refund.updated"].includes(
        event.type,
      )
    ) {
      const c = db
        .prepare<unknown[], CheckoutRow>(
          "SELECT * FROM checkouts WHERE refund_id=?",
        )
        .get(obj.id)!;
      if (c) await refund(c);
    }
    res.json({ received: true });
  }

  let reconciling = false;
  async function reconcile() {
    if (!client || reconciling) return;
    reconciling = true;
    try {
      const rows = db
        .prepare<unknown[], CheckoutRow>(
          "SELECT id FROM checkouts WHERE status IN ('creating','open','refund_pending') ORDER BY updated_at LIMIT 100",
        )
        .all();
      for (const row of rows) {
        try {
          await synchronize(row.id);
        } catch {
          /* Durable rows are retried on the next pass. */
        }
      }
    } finally {
      reconciling = false;
    }
  }
  return {
    start,
    webhook,
    cancelCheckout,
    cancelBooking,
    retryRefund,
    reconcile,
    synchronize,
    owner,
    out,
    list: (userId: number) =>
      db
        .prepare<unknown[], CheckoutRow>(
          "SELECT * FROM checkouts WHERE user_id=? ORDER BY created_at DESC LIMIT 50",
        )
        .all(userId)
        .map(out),
  };
}
