import { test, expect } from "../../fixtures/test.js";
import { stay, dateAfter } from "../../data/builders.js";

test("CAT-01 destination, amenity, price, sorting and pagination @sanity", async ({
  actors,
}) => {
  const api = actors.anonymous;
  const filtered = await api.get(
    "/properties?destination=Lisbon&amenities=WiFi&minPrice=10000&maxPrice=20000&sort=price_asc",
  );
  expect(filtered.items.length).toBeGreaterThan(0);
  for (const item of filtered.items) {
    expect(item.destination).toContain("Lisbon");
    expect(item.amenities).toContain("WiFi");
    expect(item.price_cents).toBeGreaterThanOrEqual(10000);
    expect(item.price_cents).toBeLessThanOrEqual(20000);
  }
  const first = await api.get("/properties?page=1&pageSize=2&sort=price_asc");
  const second = await api.get("/properties?page=2&pageSize=2&sort=price_asc");
  expect(first.items).toHaveLength(2);
  expect(second.items).toHaveLength(2);
  expect(
    first.items
      .map((p) => p.id)
      .some((id) => second.items.some((p) => p.id === id)),
  ).toBe(false);
  expect(first.items[0].price_cents).toBeLessThanOrEqual(
    first.items[1].price_cents,
  );
  expect((await api.get("/properties?destination=Nowhere")).items).toEqual([]);
});

test("CAT-02 availability quote uses server price and exclusive checkout date", async ({
  actors,
  system,
}) => {
  const range = stay(system.today);
  const quote = await actors.anonymous.get(
    "/properties/1/availability?" + new URLSearchParams(range),
  );
  expect(quote).toMatchObject({
    available: true,
    nights: 3,
    nightlyPriceCents: 11000,
    totalCents: 33000,
  });
});

for (const [name, change, code] of [
  [
    "past dates",
    (today) => ({
      checkIn: dateAfter(today, -2),
      checkOut: dateAfter(today, -1),
    }),
    "PAST_DATE",
  ],
  [
    "equal dates",
    (today) => ({ checkOut: dateAfter(today, 30) }),
    "INVALID_DATES",
  ],
  [
    "reversed dates",
    (today) => ({ checkOut: dateAfter(today, 29) }),
    "INVALID_DATES",
  ],
  ["zero guests", () => ({ guests: 0 }), "VALIDATION_ERROR"],
  ["excess guests", () => ({ guests: 50 }), "VALIDATION_ERROR"],
]) {
  test(`CAT-03 rejects ${name}`, async ({ actors, system }) => {
    const range = stay(system.today, change(system.today));
    const result = await actors.anonymous.get(
      "/properties/1/availability?" + new URLSearchParams(range),
      { status: 400 },
    );
    expect(result.error.code).toBe(code);
  });
}

test("CAT-04 unknown endpoints and properties have consistent errors", async ({
  actors,
}) => {
  for (const path of ["/properties/99999", "/does-not-exist"]) {
    expect(
      (await actors.anonymous.get(path, { status: 404 })).error,
    ).toMatchObject({ code: "NOT_FOUND", message: expect.any(String) });
  }
});
