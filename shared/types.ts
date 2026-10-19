export type Role = "admin" | "customer";
export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  active: boolean;
}
export interface Property {
  id: number;
  name: string;
  destination: string;
  description: string;
  price_cents: number;
  capacity: number;
  amenities: string[];
  images: string[];
  latitude: number;
  longitude: number;
  active: boolean;
  currency: string;
}
export interface StayRange {
  checkIn: string;
  checkOut: string;
  guests: number | string;
}
export interface BookingInput extends StayRange {
  propertyId: number | string;
}
export interface Quote extends BookingInput {
  propertyId: number;
  guests: number;
  nights: number;
  nightlyPriceCents: number;
  totalCents: number;
  currency: string;
}
export type PaymentStatus =
  | "paid"
  | "refund_pending"
  | "refund_failed"
  | "refunded"
  | "legacy";
export interface Booking {
  id: number;
  user_id: number;
  property_id: number;
  check_in: string;
  check_out: string;
  guests: number;
  nights: number;
  nightly_price_cents: number;
  total_cents: number;
  currency: string;
  status: "confirmed" | "cancelled";
  checkout_id: string | null;
  payment_status: PaymentStatus;
  refund_id: string | null;
  created_at: string;
  cancelled_at: string | null;
  property_name: string;
  destination: string;
  images: string[];
  customer_name: string;
  customer_email: string;
}
export type CheckoutStatus =
  | "creating"
  | "open"
  | "completed"
  | "expired"
  | "cancelled"
  | "failed"
  | "refund_pending"
  | "refunded";
export interface Checkout extends Quote {
  id: string;
  propertyName: string;
  status: CheckoutStatus;
  expiresAt: number;
  serverTime: number;
  verificationPending: boolean;
  refundStatus: "none" | "pending" | "failed" | "succeeded";
  checkoutUrl: string | null;
  cancellationRequested: boolean;
  booking: Booking | null;
}
export interface List<T> {
  items: T[];
}
export interface PropertyList extends List<Property> {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
export interface Destination {
  destination: string;
  count: number;
  latitude: number;
  longitude: number;
}
export interface Weather {
  temperature: number;
  weatherCode: number;
  windSpeed: number;
  time: string;
  temperatureUnit: string;
  windUnit: string;
  source: string;
}
