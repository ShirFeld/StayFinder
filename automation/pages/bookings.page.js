import { CancellationDialog } from "./components/cancellation-dialog.js";

export class BookingsPage {
  constructor(page) {
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
