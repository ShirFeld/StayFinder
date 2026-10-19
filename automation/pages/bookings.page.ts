import type { Locator, Page } from "@playwright/test";
import { CancellationDialog } from "./components/cancellation-dialog.ts";

export class BookingsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly emptyHeading: Locator;
  readonly cancelButton: Locator;
  readonly refundedPayment: Locator;
  readonly cancellation: CancellationDialog;
  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", {
      name: "My bookings",
      exact: true,
    });
    this.emptyHeading = page.getByRole("heading", { name: "No bookings yet" });
    this.cancelButton = page.getByRole("button", {
      name: "Cancel booking & full refund",
      exact: true,
    });
    this.refundedPayment = page.getByText("Payment: Full refund completed", {
      exact: true,
    });
    this.cancellation = new CancellationDialog(page);
  }
  async open() {
    await this.page.goto("/bookings");
  }
  async requestCancellation() {
    await this.cancelButton.click();
  }
}
