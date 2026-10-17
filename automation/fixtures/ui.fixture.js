import { test as base, expect } from "./test.js";
import { LoginPage } from "../pages/login.page.js";
import { CatalogPage } from "../pages/catalog.page.js";
import { StayPage } from "../pages/stay.page.js";
import { CheckoutPage } from "../pages/checkout.page.js";
import { BookingsPage } from "../pages/bookings.page.js";
import { AdminPage } from "../pages/admin.page.js";
import { AppShell } from "../pages/components/app-shell.js";
import { HostedPaymentStub } from "../support/hosted-payment-stub.js";

// Test-scoped: every POM uses the current test's isolated browser page.
// Playwright creates only the fixtures requested by a test.
export const test = base.extend({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  catalogPage: async ({ page }, use) => {
    await use(new CatalogPage(page));
  },
  stayPage: async ({ page }, use) => {
    await use(new StayPage(page));
  },
  checkoutPage: async ({ page }, use) => {
    await use(new CheckoutPage(page));
  },
  bookingsPage: async ({ page }, use) => {
    await use(new BookingsPage(page));
  },
  adminPage: async ({ page }, use) => {
    await use(new AdminPage(page));
  },
  appShell: async ({ page }, use) => {
    await use(new AppShell(page));
  },
  hostedPayment: async ({ page }, use) => {
    const provider = new HostedPaymentStub(page);
    await provider.install();
    try {
      await use(provider);
    } finally {
      await provider.dispose();
    }
  },
  pageErrors: async ({ page }, use) => {
    const errors = [];
    const collect = (error) => errors.push(error.message);
    page.on("pageerror", collect);
    try {
      await use(errors);
    } finally {
      page.off("pageerror", collect);
    }
  },
});
export { expect };
