import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import type { Checkout, List, User } from "../../shared/types";
import { forgetCheckoutRequest } from "./checkout-request";
import { api, ErrorBox, Load, money, send, useLoad } from "./shared";

export const paymentLabels = {
  paid: "Paid",
  refund_pending: "Full refund pending",
  refund_failed: "Refund failed — retry available",
  refunded: "Full refund completed",
  legacy: "No payment (older booking)",
};
function PaymentSummary({ checkout }: { checkout: Checkout }) {
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
      <p className="status-note">
        This price was saved when your date hold started.
      </p>
    </div>
  );
}

function stateFor(c: Checkout, remaining: number, returned: boolean) {
  if (c.booking?.status === "confirmed")
    return {
      title: "Payment verified. Booking confirmed.",
      detail:
        "Your payment has been verified and your accommodation is booked.",
      success: true,
    };
  if (c.booking?.status === "cancelled")
    return {
      title:
        c.booking.payment_status === "refunded"
          ? "Booking cancelled. Full refund completed."
          : c.booking.payment_status === "refund_failed"
            ? "Booking cancelled. Refund needs attention."
            : "Booking cancelled. Full refund pending.",
      detail:
        "Your dates have been released. " +
        (c.booking.payment_status === "refunded"
          ? "Stripe confirmed your full test refund."
          : "The refund is not yet complete. We keep the refund request and retry provider checks."),
      success: c.booking.payment_status === "refunded",
    };
  if (c.status === "refunded")
    return {
      title: "Full refund completed",
      detail: "No booking was created. Stripe confirmed the full test refund.",
      success: true,
    };
  if (c.status === "refund_pending")
    return {
      title:
        c.refundStatus === "failed"
          ? "Refund needs attention"
          : "Full refund in progress",
      detail:
        c.refundStatus === "failed"
          ? "No booking was created. Stripe reported a failed refund. Retry the full refund below."
          : "No booking was created. Your full refund is awaiting Stripe confirmation; it has not completed yet.",
    };
  if (c.cancellationRequested && ["creating", "open"].includes(c.status))
    return {
      title: "Cancellation requested",
      detail:
        "Your request is saved. We are waiting for Stripe to stop accepting payment before releasing the dates.",
    };
  if (
    c.verificationPending ||
    (["creating", "open"].includes(c.status) && remaining === 0)
  )
    return {
      title: "Date hold ended. Checking payment status.",
      detail:
        "The hold no longer blocks these dates. We are verifying whether payment completed. Do not make another payment yet; a late payment will be refunded if no booking can be confirmed.",
    };
  if (c.status === "creating")
    return {
      title: "Preparing secure checkout",
      detail:
        "Your dates are held while we contact Stripe. Refreshing this page will recover the same checkout.",
    };
  if (c.status === "open")
    return {
      title: returned
        ? "Payment is not confirmed yet"
        : "Dates temporarily held",
      detail: returned
        ? "We have not verified a successful payment yet. We will keep checking. Do not start another checkout."
        : "Continue to Stripe to pay. A declined card does not create a booking; you can retry a test card in the same checkout.",
    };
  if (c.status === "cancelled")
    return {
      title: "Checkout cancelled",
      detail: "Your dates have been released. No booking was created.",
    };
  if (c.status === "failed")
    return {
      title: "Checkout could not be opened",
      detail:
        "No booking was created. Return to the accommodation to start again.",
    };
  return {
    title: "Checkout expired",
    detail:
      "No booking was created. Choose dates again to start a new checkout.",
  };
}

export function CheckoutPage({ user }: { user: User | null }) {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const [checkout, setCheckout] = useState<Checkout | null>(null),
    [error, setError] = useState(""),
    [needsLogin, setNeedsLogin] = useState(false),
    [busy, setBusy] = useState(false),
    [clock, setClock] = useState(Date.now()),
    [offset, setOffset] = useState(0);
  const generation = useRef(0),
    pending = useRef<Promise<Checkout | null> | null>(null),
    latest = useRef<Checkout | null>(null);
  const returned = params.get("payment") === "returned";
  const accept = useCallback(
    (c: Checkout) => {
      latest.current = c;
      setCheckout(c);
      setOffset(
        (c.serverTime || Math.floor(Date.now() / 1000)) * 1000 - Date.now(),
      );
      if (!["creating", "open"].includes(c.status) && !c.verificationPending)
        forgetCheckoutRequest(user!.id, c);
    },
    [user?.id],
  );
  const run = useCallback(
    (action: "sync" | "cancel" | "refund") => {
      if (!user) return Promise.resolve(null);
      if (pending.current) return pending.current;
      const version = generation.current;
      setBusy(true);
      setError("");
      const request = send<Checkout>("/checkouts/" + id + "/" + action)
        .then((c) => {
          if (version === generation.current) {
            accept(c);
            setNeedsLogin(false);
          }
          return c;
        })
        .catch((e) => {
          if (version === generation.current) {
            setError(e.message);
            setNeedsLogin(e.status === 401);
          }
          return null;
        })
        .finally(() => {
          if (pending.current === request) pending.current = null;
          if (version === generation.current) setBusy(false);
        });
      pending.current = request;
      return request;
    },
    [id, user?.id, accept],
  );
  useEffect(() => {
    generation.current++;
    pending.current = null;
    latest.current = null;
    setCheckout(null);
    setError("");
    setNeedsLogin(false);
    if (!user) return;
    const version = generation.current;
    (async () => {
      try {
        const c = await api<Checkout>("/checkouts/" + id);
        if (version !== generation.current) return;
        accept(c);
      } catch (caught) {
        const e = caught as Error & { status?: number; code?: string };
        if (version === generation.current) {
          setError(e.message);
          setNeedsLogin(e.status === 401);
        }
        return;
      }
      if (version !== generation.current) return;
      const cancelled = params.get("payment") === "cancelled";
      const result = await run(cancelled ? "cancel" : "sync");
      if (cancelled && result && version === generation.current) {
        const next = new URLSearchParams(params);
        next.delete("payment");
        setParams(next, { replace: true });
      }
    })();
    return () => {
      generation.current++;
    };
  }, [id, user?.id]);
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (!user || needsLogin) return;
    const poll = () => {
      const c = latest.current;
      if (
        c &&
        (["creating", "open", "refund_pending"].includes(c.status) ||
          c.verificationPending)
      )
        run("sync");
    };
    const timer = setInterval(poll, 5000);
    const onFocus = () => {
      if (document.visibilityState === "visible") poll();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [id, user?.id, needsLogin, run]);
  const login =
    "/login?next=" + encodeURIComponent("/checkout/" + id + "?" + params);
  if (!user)
    return (
      <div className="container section">
        <h1>Sign in to view your checkout</h1>
        <p>Your checkout is saved. Sign in again to recover its status.</p>
        <Link className="button" to={login}>
          Sign in
        </Link>
      </div>
    );
  const remaining = checkout
    ? Math.max(0, checkout.expiresAt - Math.floor((clock + offset) / 1000))
    : 0;
  const active =
    checkout && ["creating", "open"].includes(checkout.status) && remaining > 0;
  const state = checkout ? stateFor(checkout, remaining, returned) : null;
  const refundFailed =
    checkout?.refundStatus === "failed" ||
    checkout?.booking?.payment_status === "refund_failed";
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
      {needsLogin && (
        <Link className="button" to={login}>
          Sign in to recover checkout
        </Link>
      )}
      {!checkout && !error && (
        <p role="status">Loading your saved checkout...</p>
      )}
      {checkout && (
        <>
          <PaymentSummary checkout={checkout} />
          <section
            className={
              "notice payment-state " + (state!.success ? "success" : "warning")
            }
            aria-label="Payment and booking status"
          >
            <div role="status" aria-live="polite" aria-atomic="true">
              <h3>{state!.title}</h3>
              <p>{state!.detail}</p>
            </div>
            {checkout.booking && (
              <>
                <p>
                  Confirmation #{checkout.booking.id} ·{" "}
                  {money(checkout.booking.total_cents)}
                </p>
                <p>Payment: {paymentLabels[checkout.booking.payment_status]}</p>
                <Link className="button" to="/bookings">
                  View my bookings
                </Link>
              </>
            )}
            {active && (
              <p>
                Time remaining:{" "}
                <strong aria-live="off">
                  {Math.floor(remaining / 60)}:
                  {String(remaining % 60).padStart(2, "0")}
                </strong>
              </p>
            )}
            {active &&
              checkout.checkoutUrl &&
              !checkout.cancellationRequested &&
              !returned && (
                <a className="button" href={checkout.checkoutUrl}>
                  Continue to Stripe Checkout
                </a>
              )}
            {active &&
              returned &&
              checkout.checkoutUrl &&
              !checkout.cancellationRequested && (
                <a className="button" href={checkout.checkoutUrl}>
                  Return to the same Stripe checkout
                </a>
              )}
            {!needsLogin && (
              <div className="tabs">
                <button
                  className="outline"
                  disabled={busy}
                  onClick={() => run("sync")}
                >
                  {busy ? "Checking..." : "Check payment status"}
                </button>
                {active && !checkout.cancellationRequested && (
                  <button
                    className="outline"
                    disabled={busy}
                    onClick={() => run("cancel")}
                  >
                    Cancel checkout and release dates
                  </button>
                )}
                {refundFailed && (
                  <button disabled={busy} onClick={() => run("refund")}>
                    Retry full refund
                  </button>
                )}
              </div>
            )}
            {!active &&
              !checkout.verificationPending &&
              !checkout.booking &&
              checkout.status !== "refund_pending" && (
                <Link
                  className="button"
                  to={
                    "/stays/" +
                    checkout.propertyId +
                    "?" +
                    new URLSearchParams({
                      checkIn: checkout.checkIn,
                      checkOut: checkout.checkOut,
                      guests: String(checkout.guests),
                    })
                  }
                >
                  Back to accommodation
                </Link>
              )}
          </section>
        </>
      )}
      {!checkout && error && !needsLogin && (
        <button className="outline" disabled={busy} onClick={() => run("sync")}>
          Retry payment status
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
  const state = useLoad<List<Checkout>>("/checkouts");
  const items =
    state.data?.items.filter(
      (c) =>
        (["creating", "open", "refund_pending"].includes(c.status) ||
          c.verificationPending) &&
        !c.booking,
    ) || [];
  return (
    <Load state={state}>
      {items.length > 0 && (
        <section
          className="pending-checkouts"
          aria-label="Checkouts awaiting completion"
        >
          <h2>Checkouts awaiting completion</h2>
          <p className="muted">
            These are saved checkouts, not confirmed bookings. Recover them here
            after closing the browser or returning from payment.
          </p>
          {items.map((c) => (
            <article className="notice" key={c.id}>
              <h3>{c.propertyName}</h3>
              <p>
                {c.checkIn} to {c.checkOut} · {money(c.totalCents)}
              </p>
              <p>
                {c.verificationPending
                  ? "Hold ended; payment verification pending"
                  : c.cancellationRequested
                    ? "Cancellation requested"
                    : c.status === "refund_pending"
                      ? c.refundStatus === "failed"
                        ? "Refund needs attention"
                        : "Full refund pending"
                      : "Awaiting payment"}
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
