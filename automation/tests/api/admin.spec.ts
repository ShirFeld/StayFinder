import { propertyData, stay, userData } from "../../data/builders.ts";
import { expect, test } from "../../fixtures/test.ts";

test("ADM-01 create, edit and deactivate property; existing booking is retained", async ({
  actors,
  system,
}) => {
  const p = await actors.admin.post("/admin/properties", propertyData(), {
    status: 201,
  });
  expect(
    (await actors.admin.get("/admin/properties")).items.map(
      (item: { id: number }) => item.id,
    ),
  ).toContain(p.id);
  const c = await actors.customer.checkout(
    stay(system.today, { propertyId: p.id }),
  );
  system.pay(c.id);
  await actors.customer.post(`/checkouts/${c.id}/sync`);
  await actors.admin.put(
    `/admin/properties/${p.id}`,
    propertyData({ name: "Edited Retreat", active: false }),
  );
  await actors.anonymous.get(`/properties/${p.id}`, { status: 404 });
  expect((await actors.customer.get("/bookings")).items).toHaveLength(1);
  await actors.other.checkout(stay(system.today, { propertyId: p.id }), {
    status: 404,
  });
  expect(
    (await actors.admin.get("/admin/bookings")).items[0].property_name,
  ).toBe("Edited Retreat");
});

test("ADM-02 unique email, password hashing, role updates and immediate session revocation @db", async ({
  actors,
  system,
}) => {
  const data = userData();
  const u = await actors.admin.post("/admin/users", data, { status: 201 });
  expect(u).toMatchObject({
    email: data.email,
    role: "customer",
    active: true,
  });
  expect(u).not.toHaveProperty("password_hash");
  expect(
    system.db.one("SELECT password_hash FROM users WHERE id=?", u.id)
      .password_hash,
  ).not.toBe(data.password);
  expect(
    (
      await actors.admin.post(
        "/admin/users",
        { ...data, email: data.email.toUpperCase() },
        { status: 409 },
      )
    ).error.code,
  ).toBe("EMAIL_EXISTS");
  await actors.anonymous.post("/auth/login", data);
  await actors.admin.patch(`/admin/users/${u.id}`, {
    role: "admin",
    active: true,
  });
  await actors.anonymous.get("/admin/users");
  await actors.admin.patch(`/admin/users/${u.id}`, {
    role: "customer",
    active: false,
  });
  await actors.anonymous.get("/bookings", { status: 401 });
  await actors.anonymous.post(
    "/auth/login",
    { email: data.email, password: data.password },
    { status: 401 },
  );
  expect(
    (await actors.admin.get("/admin/users")).items.map(
      (item: { id: number }) => item.id,
    ),
  ).toContain(u.id);
});

test("ADM-03 admin cannot disable self; customer cannot mutate admin resources", async ({
  actors,
}) => {
  const self = (await actors.admin.get("/auth/me")).user;
  expect(
    (
      await actors.admin.patch(
        `/admin/users/${self.id}`,
        { active: false, role: "admin" },
        { status: 409 },
      )
    ).error.code,
  ).toBe("SELF_LOCKOUT");
  await actors.customer.post("/admin/properties", propertyData(), {
    status: 403,
  });
  await actors.customer.put("/admin/properties/1", propertyData(), {
    status: 403,
  });
  await actors.customer.post("/admin/users", userData(), { status: 403 });
  await actors.customer.patch(
    "/admin/users/3",
    { active: false, role: "admin" },
    { status: 403 },
  );
});
