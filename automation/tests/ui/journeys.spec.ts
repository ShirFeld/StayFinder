import { stay } from "../../data/builders.ts";
import { expect, test } from "../../fixtures/ui.fixture.ts";

test("UI-01 login, catalog, listing details and logout @sanity", async ({
  loginPage,
  catalogPage,
  stayPage,
  appShell,
}) => {
  await loginPage.signIn();
  await expect(catalogPage.heading).toBeVisible();
  await catalogPage.openFirstStay();
  await expect(stayPage.availabilityButton).toBeVisible();
  await expect(stayPage.heading).toBeVisible();
  await appShell.signOut();
  await expect(appShell.signInLink).toBeVisible();
});

test("UI-02 invalid credentials show accessible error without signing in", async ({
  page,
  loginPage,
}) => {
  await loginPage.open();
  await loginPage.submitCredentials({
    email: "jamie@stayfinder.demo",
    password: "incorrect-password",
  });
  await expect(loginPage.error).toContainText("Email or password is incorrect");
  await expect(page).toHaveURL(/\/login$/);
});

test("UI-03 filter navigation and responsive layout @sanity", async ({
  page,
  catalogPage,
  stayPage,
  pageErrors,
}) => {
  await catalogPage.open({ destination: "Lisbon", sort: "price_asc" });
  await expect(catalogPage.heading).toBeVisible();
  await catalogPage.openFirstStay();
  expect(new URL(page.url()).searchParams.get("destination")).toBe("Lisbon");
  await stayPage.returnToCatalog();
  await expect(page).toHaveURL(/destination=Lisbon/);
  expect(await catalogPage.hasHorizontalOverflow()).toBe(false);
  expect(pageErrors).toEqual([]);
});

test("UI-04 quote, hosted redirect, verified payment, booking and confirmed refund @payments @sanity", async ({
  loginPage,
  stayPage,
  checkoutPage,
  bookingsPage,
  hostedPayment,
  system,
}) => {
  await loginPage.signIn();
  await stayPage.quote(stay(system.today));
  await stayPage.continueToPayment();
  await expect(hostedPayment.heading).toBeVisible();
  const checkout = system.db.one("SELECT id FROM checkouts");
  expect(system.db.one("SELECT count(*) n FROM bookings").n).toBe(0);
  system.pay(checkout.id);
  await checkoutPage.open(checkout.id, { returned: true });
  await expect(checkoutPage.myBookingsLink).toBeVisible();
  await checkoutPage.viewBookings();
  await expect(bookingsPage.heading).toBeVisible();
  await bookingsPage.requestCancellation();
  await expect(bookingsPage.cancellation.keepButton).toBeFocused();
  await bookingsPage.cancellation.dismissWithEscape();
  await expect(bookingsPage.cancellation.root).toBeHidden();
  expect(system.db.one("SELECT status FROM bookings").status).toBe("confirmed");
  await bookingsPage.requestCancellation();
  await bookingsPage.cancellation.confirmFullRefund();
  await expect(bookingsPage.cancellation.root).toBeHidden();
  await expect(bookingsPage.refundedPayment).toBeVisible();
  expect(system.db.one("SELECT status,payment_status FROM bookings")).toEqual({
    status: "cancelled",
    payment_status: "refunded",
  });
});

test("UI-05 pending checkout survives reload and can be cancelled @payments", async ({
  loginPage,
  checkoutPage,
  actors,
  system,
}) => {
  await loginPage.signIn();
  const checkout = await actors.customer.checkout(stay(system.today));
  await checkoutPage.open(checkout.id);
  await expect(checkoutPage.stripeLink).toBeVisible();
  await checkoutPage.reload();
  await expect(checkoutPage.stripeLink).toBeVisible();
  await checkoutPage.cancelAndReleaseDates();
  await expect(checkoutPage.accommodationLink).toBeVisible();
  expect((await actors.customer.get(`/checkouts/${checkout.id}`)).status).toBe(
    "cancelled",
  );
  expect(system.db.one("SELECT count(*) n FROM bookings").n).toBe(0);
});

test("UI-06 empty booking state and admin route permissions", async ({
  loginPage,
  bookingsPage,
  adminPage,
}) => {
  await loginPage.signIn("customer", "/bookings");
  await expect(bookingsPage.emptyHeading).toBeVisible();
  await adminPage.open();
  await expect(adminPage.accessRequiredHeading).toBeVisible();
});

test("UI-07 administrator can inspect all management sections", async ({
  loginPage,
  adminPage,
}) => {
  await loginPage.signIn("admin", "/admin");
  await expect(adminPage.heading).toBeVisible();
  await expect(adminPage.addAccommodationButton).toBeVisible();
  await adminPage.showUsers();
  await expect(adminPage.userEmail("jamie@stayfinder.demo")).toBeVisible();
  await adminPage.showBookings();
  await expect(adminPage.emptyBookingsMessage).toBeVisible();
});

test("UI-08 keyboard skip link focuses main content", async ({
  catalogPage,
  appShell,
}) => {
  await catalogPage.open();
  await expect(catalogPage.heading).toBeVisible();
  await appShell.skipToMainContent();
  await expect(appShell.mainContent).toBeFocused();
});
