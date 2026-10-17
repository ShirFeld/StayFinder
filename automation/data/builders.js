import { randomUUID } from "node:crypto";

export const accounts = {
  customer: { email: "jamie@stayfinder.demo", password: "StayFinder123!" },
  other: { email: "taylor@stayfinder.demo", password: "StayFinder123!" },
  admin: { email: "admin@stayfinder.demo", password: "StayFinder123!" },
};

// Use the server business day, not a fixed date that will expire later.
export function dateAfter(today, offset) {
  const date = new Date(today + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
export function stay(today, overrides = {}) {
  return {
    propertyId: 1,
    checkIn: dateAfter(today, 30),
    checkOut: dateAfter(today, 33),
    guests: 2,
    ...overrides,
  };
}
export function propertyData(overrides = {}) {
  return {
    name: "Automation Retreat",
    destination: "Lisbon",
    description: "An isolated automation listing.",
    priceCents: 12500,
    capacity: 4,
    amenities: ["WiFi", "Kitchen"],
    images: ["https://example.com/stay.jpg"],
    latitude: 38.72,
    longitude: -9.13,
    active: true,
    ...overrides,
  };
}
export function userData(overrides = {}) {
  return {
    name: "Automation Customer",
    email: `qa-${randomUUID()}@stayfinder.demo`,
    password: "Automation123!",
    role: "customer",
    ...overrides,
  };
}
