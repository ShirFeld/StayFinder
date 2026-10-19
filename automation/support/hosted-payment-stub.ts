import type { Locator, Page, Route } from "@playwright/test";
// External provider substitute, not a Page Object for StayFinder or the real Stripe form.
export class HostedPaymentStub {
  readonly page: Page;
  readonly heading: Locator;
  readonly pattern: string;
  readonly handler: (route: Route) => Promise<void>;
  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", {
      name: "Controlled payment provider",
    });
    this.pattern = "https://checkout.stripe.com/**";
    this.handler = (route: Route) =>
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
