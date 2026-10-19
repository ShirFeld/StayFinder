interface UiFixtures {
  loginPage: LoginPage;
  catalogPage: CatalogPage;
  stayPage: StayPage;
  checkoutPage: CheckoutPage;
  bookingsPage: BookingsPage;
  adminPage: AdminPage;
  appShell: AppShell;
  hostedPayment: HostedPaymentStub;
  pageErrors: string[];
}
import { AdminPage } from "../pages/admin.page.ts";
import { BookingsPage } from "../pages/bookings.page.ts";
import { CatalogPage } from "../pages/catalog.page.ts";
import { CheckoutPage } from "../pages/checkout.page.ts";
import { AppShell } from "../pages/components/app-shell.ts";
import { LoginPage } from "../pages/login.page.ts";
import { StayPage } from "../pages/stay.page.ts";
import { HostedPaymentStub } from "../support/hosted-payment-stub.ts";
import { test as base, expect } from "./test.ts";

// Test-scoped: every POM uses the current test's isolated browser page.
// Playwright creates only the fixtures requested by a test.
export const test = base.extend<UiFixtures>({
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
    const errors: string[] = [];
    const collect = (error: Error) => errors.push(error.message);
    page.on("pageerror", collect);
    try {
      await use(errors);
    } finally {
      page.off("pageerror", collect);
    }
  },
});
export { expect };
