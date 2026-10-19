import type { Locator, Page } from "@playwright/test";
export class AdminPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly accessRequiredHeading: Locator;
  readonly addAccommodationButton: Locator;
  readonly usersButton: Locator;
  readonly bookingsButton: Locator;
  readonly emptyBookingsMessage: Locator;
  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: "Admin workspace" });
    this.accessRequiredHeading = page.getByRole("heading", {
      name: /Administrator access/,
    });
    this.addAccommodationButton = page.getByRole("button", {
      name: "Add accommodation",
    });
    this.usersButton = page.getByRole("button", { name: "Users", exact: true });
    this.bookingsButton = page.getByRole("button", {
      name: "Bookings",
      exact: true,
    });
    this.emptyBookingsMessage = page.getByText("There are no bookings yet.", {
      exact: true,
    });
  }
  async open() {
    await this.page.goto("/admin");
  }
  async showUsers() {
    await this.usersButton.click();
  }
  async showBookings() {
    await this.bookingsButton.click();
  }
  userEmail(email: string) {
    return this.page.getByText(email, { exact: true });
  }
}
