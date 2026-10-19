import assert from "node:assert/strict";
import Stripe from "stripe";

// Deterministic provider double for tests only. The application has no fake-payment mode.
import type { PaymentRefund, PaymentSession } from "../src/types.ts";
export class StripeDouble {
  creationRequests = new Map<string, Stripe.Checkout.SessionCreateParams>();
  sessions = new Map<string, PaymentSession & { amount_total: number }>();
  refundsById = new Map<string, PaymentRefund>();
  idempotency = new Map<string, string>();
  createCalls = 0;
  refundCreates = 0;
  unavailable = false;
  createTimeoutOnce = false;
  refundUnavailable = false;
  refundStatus: NonNullable<PaymentRefund["status"]> = "succeeded";
  expireRace = false;
  webhooks = new Stripe("sk_test_signature_verification_only").webhooks;
  checkout = {
    sessions: {
      create: async (
        params: Stripe.Checkout.SessionCreateParams,
        options: Stripe.RequestOptions,
      ) => {
        if (this.unavailable) throw new Error("Provider unavailable");
        const key = options.idempotencyKey!;
        if (this.idempotency.has(key)) {
          assert.deepEqual(params, this.creationRequests.get(key));
          return structuredClone(
            this.sessions.get(this.idempotency.get(key)!)!,
          );
        }
        this.creationRequests.set(key, structuredClone(params));
        this.createCalls++;
        const id = "cs_test_" + this.createCalls,
          item = params.line_items![0];
        const session: PaymentSession & { amount_total: number } = {
          id,
          livemode: false,
          mode: "payment",
          status: "open",
          payment_status: "unpaid",
          payment_intent: null,
          client_reference_id: params.client_reference_id ?? null,
          metadata: params.metadata as Record<string, string>,
          currency: "usd",
          amount_total: item.quantity! * item.price_data!.unit_amount!,
          expires_at: params.expires_at!,
          url: "https://checkout.stripe.com/c/pay/" + id,
        };
        this.sessions.set(id, session);
        this.idempotency.set(key, id);
        if (this.createTimeoutOnce) {
          this.createTimeoutOnce = false;
          throw new Error("Connection lost after provider accepted request");
        }
        return structuredClone(session);
      },
      retrieve: async (id: string) => {
        if (this.unavailable) throw new Error("Provider unavailable");
        const s = this.sessions.get(id)!;
        if (!s) throw new Error("Missing session");
        return structuredClone(s);
      },
      expire: async (id: string) => {
        if (this.unavailable) throw new Error("Provider unavailable");
        const s = this.sessions.get(id)!;
        if (this.expireRace) {
          this.expireRace = false;
          this.pay(id);
        }
        if (s.status === "complete") throw new Error("Already completed");
        s.status = "expired";
        return structuredClone(s);
      },
    },
  };
  refunds = {
    create: async (
      params: Stripe.RefundCreateParams,
      options: Stripe.RequestOptions,
    ) => {
      if (this.refundUnavailable) throw new Error("Refund connection failed");
      const key = options.idempotencyKey!;
      if (this.idempotency.has(key))
        return structuredClone(
          this.refundsById.get(this.idempotency.get(key)!)!,
        );
      this.refundCreates++;
      const s = [...this.sessions.values()].find(
        (s) => s.payment_intent === params.payment_intent,
      );
      if (!s) throw new Error("Missing payment");
      const r: PaymentRefund = {
        id: "re_test_" + this.refundCreates,
        payment_intent: s.payment_intent,
        amount: s.amount_total!,
        currency: "usd",
        status: this.refundStatus,
      };
      this.refundsById.set(r.id, r);
      this.idempotency.set(key, r.id);
      return structuredClone(r);
    },
    retrieve: async (id: string) => {
      if (this.refundUnavailable) throw new Error("Refund connection failed");
      return structuredClone(this.refundsById.get(id)!);
    },
  };
  pay(id: string) {
    const s = this.sessions.get(id)!;
    s.payment_status = "paid";
    s.status = "complete";
    s.payment_intent = "pi_test_" + id;
  }
}
