import type { Locator, Page } from "@playwright/test";
export class StayPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly checkIn: Locator;
  readonly checkOut: Locator;
  readonly guests: Locator;
  readonly availabilityButton: Locator;
  readonly continueButton: Locator;
  readonly allStaysLink: Locator;
  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { level: 1 });
    this.checkIn = page.getByLabel("Check in", { exact: true });
    this.checkOut = page.getByLabel("Check out", { exact: true });
    this.guests = page.getByLabel("Guests", { exact: true });
    this.availabilityButton = page.getByRole("button", {
      name: "Check availability",
      exact: true,
    });
    this.continueButton = page.getByRole("button", {
      name: "Continue to payment",
      exact: true,
    });
    this.allStaysLink = page.getByRole("link", { name: /All stays/ });
  }
  async open(propertyId: number | string) {
    await this.page.goto("/stays/" + propertyId);
  }
  async quote(range: import("../../shared/types.ts").BookingInput) {
    await this.open(range.propertyId);
    await this.checkIn.fill(range.checkIn);
    await this.checkOut.fill(range.checkOut);
    await this.guests.fill(String(range.guests));
    await this.availabilityButton.click();
  }
  async continueToPayment() {
    await this.continueButton.click();
  }
  async returnToCatalog() {
    await this.allStaysLink.click();
  }
}
