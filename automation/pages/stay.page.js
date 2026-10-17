export class StayPage {
  constructor(page) {
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
  async open(propertyId) {
    await this.page.goto("/stays/" + propertyId);
  }
  async quote(range) {
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
