import type { Locator, Page } from "@playwright/test";
export class CheckoutPage {
  readonly page: Page;
  readonly myBookingsLink: Locator;
  readonly stripeLink: Locator;
  readonly cancelButton: Locator;
  readonly accommodationLink: Locator;
  constructor(page: Page) {
    this.page = page;
    this.myBookingsLink = page.getByRole("link", { name: "View my bookings" });
    this.stripeLink = page.getByRole("link", {
      name: "Continue to Stripe Checkout",
    });
    this.cancelButton = page.getByRole("button", {
      name: "Cancel checkout and release dates",
    });
    this.accommodationLink = page.getByRole("link", {
      name: "Back to accommodation",
    });
  }
  async open(id: string, { returned = false } = {}) {
    await this.page.goto(
      `/checkout/${id}` + (returned ? "?payment=returned" : ""),
    );
  }
  async reload() {
    await this.page.reload();
  }
  async viewBookings() {
    await this.myBookingsLink.click();
  }
  async cancelAndReleaseDates() {
    await this.cancelButton.click();
  }
}
