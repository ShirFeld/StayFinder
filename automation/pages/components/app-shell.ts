import type { Locator, Page } from "@playwright/test";
export class AppShell {
  readonly page: Page;
  readonly signOutButton: Locator;
  readonly signInLink: Locator;
  readonly skipLink: Locator;
  readonly mainContent: Locator;
  constructor(page: Page) {
    this.page = page;
    this.signOutButton = page.getByRole("button", { name: "Sign out" });
    this.signInLink = page.getByRole("link", { name: "Sign in", exact: true });
    this.skipLink = page.getByRole("link", { name: "Skip to main content" });
    this.mainContent = page.locator("#main-content");
  }
  async signOut() {
    await this.signOutButton.click();
  }
  async skipToMainContent() {
    await this.skipLink.focus();
    await this.page.keyboard.press("Enter");
  }
}
