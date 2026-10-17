// External provider substitute, not a Page Object for StayFinder or the real Stripe form.
export class HostedPaymentStub {
  constructor(page) {
    this.page = page;
    this.heading = page.getByRole("heading", {
      name: "Controlled payment provider",
    });
    this.pattern = "https://checkout.stripe.com/**";
    this.handler = (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<html><body><h1>Controlled payment provider</h1><p>Automation only; no card is charged.</p></body></html>",
      });
  }
  async install() {
    await this.page.route(this.pattern, this.handler);
  }
  async dispose() {
    await this.page.unroute(this.pattern, this.handler);
  }
}
