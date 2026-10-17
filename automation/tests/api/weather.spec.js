import { test, expect } from "../../fixtures/test.js";
import { stay } from "../../data/builders.js";

test("WEA-01 weather is mapped from provider response @sanity", async ({
  actors,
}) => {
  expect(await actors.anonymous.get("/weather?propertyId=1")).toMatchObject({
    temperature: 23,
    windSpeed: 7,
    source: "Open-Meteo",
  });
});
for (const mode of ["http", "malformed", "timeout"]) {
  test(`WEA-02 ${mode} failure is clear and never blocks checkout`, async ({
    actors,
    system,
  }) => {
    system.weather.mode = mode;
    const error = await actors.anonymous.get("/weather?propertyId=1", {
      status: 503,
    });
    expect(error.error.code).toBe("WEATHER_UNAVAILABLE");
    expect((await actors.customer.checkout(stay(system.today))).status).toBe(
      "open",
    );
  });
}
