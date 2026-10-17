export class CancellationDialog {
  constructor(page) {
    this.page = page;
    this.root = page.getByRole("dialog", { name: "Cancel this booking?" });
    this.keepButton = this.root.getByRole("button", { name: "Keep booking" });
    this.confirmButton = this.root.getByRole("button", {
      name: "Cancel and request full refund",
    });
  }
  async dismissWithEscape() {
    await this.page.keyboard.press("Escape");
  }
  async keepBooking() {
    await this.keepButton.click();
  }
  async confirmFullRefund() {
    await this.confirmButton.click();
  }
}
