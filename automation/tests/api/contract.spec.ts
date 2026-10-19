import { readFileSync } from "node:fs";
import { expect, test } from "../../fixtures/test.ts";
const manifest = JSON.parse(
  readFileSync(new URL("../../data/endpoints.json", import.meta.url), "utf8"),
);

test("CON-01 every documented operation has an explicit test mapping", async ({
  actors,
}) => {
  const spec = (await actors.anonymous.get("/openapi.json")) as {
    paths: Record<string, Record<string, unknown>>;
    components: { schemas: Record<string, unknown> };
  };
  const operations = Object.entries(spec.paths).flatMap(([route, definition]) =>
    Object.keys(definition)
      .filter((method) =>
        ["get", "post", "put", "patch", "delete"].includes(method),
      )
      .map((method) => method.toUpperCase() + " " + route),
  );
  expect(Object.keys(manifest).sort()).toEqual(operations.sort());
  expect(spec.components.schemas).toHaveProperty("Error");
});
