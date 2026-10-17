import React, { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, send, money, ErrorBox, useLoad, Load } from "./shared";

function PaymentSummary({ checkout }) {
  return (
    <div className="payment-summary">
      <h2>{checkout.propertyName}</h2>
      <p>
        {checkout.checkIn} to {checkout.checkOut}
      </p>
      <p>
        {checkout.guests} guests · {checkout.nights} nights ×{" "}
        {money(checkout.nightlyPriceCents)}
      </p>
      <p className="payment-total">
        Total <strong>{money(checkout.totalCents)} USD</strong>
      </p>
    </div>
  );
}

export function CheckoutPage({ user }) {
  const { id } = useParams();
  const [params] = useSearchParams();
  const [checkout, setCheckout] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [clock, setClock] = useState(Date.now());
  const cancelled = params.get("payment") === "cancelled";
  async function sync() {
    setBusy(true);
    setError("");
    try {
      setCheckout(await send("/checkouts/" + id + "/sync"));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    setBusy(true);
    setError("");
    try {
      setCheckout(await send("/checkouts/" + id + "/cancel"));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!user) return;
    let alive = true;
    send("/checkouts/" + id + (cancelled ? "/cancel" : "/sync"))
      .then((c) => alive && setCheckout(c))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [id, user, cancelled]);
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (
      !user ||
      !checkout ||
      !["creating", "open", "refund_pending"].includes(checkout.status)
    )
      return;
    let alive = true,
      inFlight = false;
    const timer = setInterval(async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const c = await send("/checkouts/" + id + "/sync");
        if (alive) {
          setCheckout(c);
          setError("");
        }
      } catch (e) {
        if (alive) setError(e.message);
      } finally {
        inFlight = false;
      }
    }, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [id, user, checkout?.status]);
  if (!user)
    return (
      <div className="container section">
        <h1>Sign in to view your checkout</h1>
        <Link
          className="button"
          to={
            "/login?next=" +
            encodeURIComponent("/checkout/" + id + "?" + params)
          }
        >
          Sign in
        </Link>
      </div>
    );
  const remaining = checkout
    ? Math.max(0, checkout.expiresAt - Math.floor(clock / 1000))
    : 0;
  const active =
    checkout && ["creating", "open"].includes(checkout.status) && remaining > 0;
  return (
    <div className="container section checkout-page">
      <p className="eyebrow">YOUR NEXT ESCAPE</p>
      <h1>
        {checkout?.booking?.status === "confirmed"
          ? "Your escape is booked!"
          : "Your checkout"}
      </h1>
      <p className="notice">Test payments only. No real money is charged.</p>
      <ErrorBox error={error} />
      {!checkout && !error && (
        <p role="status">Checking payment with Stripe...</p>
      )}
      {checkout && (
        <>
          <PaymentSummary checkout={checkout} />
          {checkout.booking ? (
            <div className="notice success" role="status">
              <h3>
                {checkout.booking.status === "cancelled"
                  ? "This booking was cancelled"
                  : "Payment verified. Booking confirmed."}
              </h3>
              <p>
                Confirmation #{checkout.booking.id} ·{" "}
                {money(checkout.booking.total_cents)}
              </p>
              <p>
                Payment: {checkout.booking.payment_status.replaceAll("_", " ")}
              </p>
              <Link className="button" to="/bookings">
                View my bookings
              </Link>
            </div>
          ) : active ? (
            <div className="booking-panel">
              <h3>
                {checkout.cancellationRequested
                  ? "Releasing your dates..."
                  : "Dates temporarily held"}
              </h3>
              <p>
                Time remaining:{" "}
                <strong aria-live="off">
                  {Math.floor(remaining / 60)}:
                  {String(remaining % 60).padStart(2, "0")}
                </strong>
              </p>
              <p>
                Your booking will be created only after Stripe confirms payment.
                A declined card does not create a booking; you can try another
                test card in Stripe.
              </p>
              {checkout.checkoutUrl && (
                <a className="button" href={checkout.checkoutUrl}>
                  Continue to Stripe Checkout
                </a>
              )}
              <div className="tabs">
                <button className="outline" disabled={busy} onClick={sync}>
                  {busy ? "Checking..." : "Check payment status"}
                </button>
                <button className="outline" disabled={busy} onClick={cancel}>
                  Cancel checkout and release dates
                </button>
              </div>
            </div>
          ) : (
            <div className="notice" role="status">
              <h3>
                {checkout.status === "refunded"
                  ? "Payment refunded"
                  : checkout.status === "refund_pending"
                    ? "Full refund in progress"
                    : checkout.status === "cancelled"
                      ? "Checkout cancelled"
                      : checkout.status === "failed"
                        ? "Checkout could not be opened"
                        : "Your date hold has expired"}
              </h3>
              <p>
                {["refund_pending", "refunded"].includes(checkout.status)
                  ? "No booking was created. Any successful test payment is refunded in full because this checkout could not be confirmed."
                  : "No booking was created. Choose dates again to start a new checkout."}
              </p>
              <Link className="button" to={"/stays/" + checkout.propertyId}>
                Back to accommodation
              </Link>
            </div>
          )}
        </>
      )}
      {(error || checkout?.status === "refund_pending") && (
        <button className="outline" disabled={busy} onClick={sync}>
          {busy ? "Checking..." : "Retry payment status"}
        </button>
      )}
      <p className="muted fine">
        Use Stripe test cards only. Try 4242 4242 4242 4242 for a successful
        payment, a future expiry date, and any three-digit CVC. Use 4000 0000
        0000 0002 to test a declined card.
      </p>
    </div>
  );
}

export function PendingCheckouts() {
  const state = useLoad("/checkouts");
  const items =
    state.data?.items.filter(
      (c) =>
        ["creating", "open", "refund_pending"].includes(c.status) && !c.booking,
    ) || [];
  return (
    <Load state={state}>
      {items.length > 0 && (
        <section className="pending-checkouts">
          <h2>Checkouts awaiting completion</h2>
          <p className="muted">
            These are temporary date holds, not confirmed bookings.
          </p>
          {items.map((c) => (
            <article className="notice" key={c.id}>
              <h3>{c.propertyName}</h3>
              <p>
                {c.checkIn} to {c.checkOut} · {money(c.totalCents)} ·{" "}
                {c.status.replaceAll("_", " ")}
              </p>
              <Link className="button small" to={"/checkout/" + c.id}>
                View checkout
              </Link>
            </article>
          ))}
        </section>
      )}
    </Load>
  );
}
