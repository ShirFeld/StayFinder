import type Stripe from "stripe";
import type {
  Booking,
  BookingInput,
  Checkout,
  CheckoutStatus,
  Property,
  Quote,
  User,
} from "../../shared/types.ts";
export type UserRow = Omit<User, "active"> & {
  active: number;
  password_hash: string;
  created_at: string;
};
export type PropertyRow = Omit<
  Property,
  "amenities" | "images" | "active" | "currency"
> & { amenities: string; images: string; active: number; created_at: string };
export type BookingRow = Omit<Booking, "images"> & { images: string };
export interface CheckoutRow {
  id: string;
  user_id: number;
  property_id: number;
  request_key: string;
  check_in: string;
  check_out: string;
  guests: number;
  nights: number;
  nightly_price_cents: number;
  total_cents: number;
  currency: string;
  property_name: string;
  customer_email: string;
  status: CheckoutStatus;
  expires_at: number;
  stripe_expires_at: number;
  stripe_session_id: string | null;
  checkout_url: string | null;
  payment_intent_id: string | null;
  refund_id: string | null;
  refund_attempt: number;
  cancel_requested: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  return_origin: string;
  refund_status: Checkout["refundStatus"];
}
export type SessionRow = { data: string; sid: string; expires: number };
export type Fail = (status: number, code: string, message: string) => never;
// This is the SDK surface used by payments, allowing the deterministic provider double.
export interface PaymentProvider {
  checkout: {
    sessions: {
      create(
        params: Stripe.Checkout.SessionCreateParams,
        options: Stripe.RequestOptions,
      ): Promise<PaymentSession>;
      retrieve(id: string): Promise<PaymentSession>;
      expire(id: string): Promise<PaymentSession>;
    };
  };
  refunds: {
    create(
      params: Stripe.RefundCreateParams,
      options: Stripe.RequestOptions,
    ): Promise<PaymentRefund>;
    retrieve(id: string): Promise<PaymentRefund>;
  };
  webhooks: Pick<Stripe.Webhooks, "constructEvent">;
}
export type PaymentSession = Pick<
  Stripe.Checkout.Session,
  | "id"
  | "livemode"
  | "mode"
  | "status"
  | "payment_status"
  | "payment_intent"
  | "client_reference_id"
  | "metadata"
  | "currency"
  | "amount_total"
  | "expires_at"
  | "url"
>;
export type PaymentRefund = Pick<
  Stripe.Refund,
  "id" | "payment_intent" | "amount" | "currency" | "status"
>;
export interface PaymentOptions {
  stripe?: PaymentProvider;
  quote: (input: BookingInput) => Quote;
  integer: (value: unknown, name: string, min?: number, max?: number) => number;
  fail: Fail;
  bookingSelect: string;
  bookingOut: (row: BookingRow) => Booking;
}
declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}
declare global {
  namespace Express {
    interface Request {
      user: UserRow;
    }
  }
}
