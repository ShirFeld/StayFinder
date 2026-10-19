import type { Locator, Page } from "@playwright/test";
export class CatalogPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly stayLinks: Locator;
  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: "Find your next escape" });
    this.stayLinks = page.getByRole("link", { name: /^View / });
  }
  async open(filters: Record<string, string> = {}) {
    const query = new URLSearchParams(filters).toString();
    await this.page.goto("/stays" + (query ? "?" + query : ""));
  }
  async openFirstStay() {
    await this.stayLinks.first().click();
  }
  async hasHorizontalOverflow() {
    return this.page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
  }
}
