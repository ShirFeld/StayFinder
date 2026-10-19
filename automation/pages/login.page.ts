import type { Locator, Page } from "@playwright/test";
import { accounts } from "../data/builders.ts";

export class LoginPage {
  readonly page: Page;
  readonly email: Locator;
  readonly password: Locator;
  readonly submitButton: Locator;
  readonly error: Locator;
  constructor(page: Page) {
    this.page = page;
    this.email = page.getByLabel("Email address");
    this.password = page.getByLabel("Password", { exact: true });
    this.submitButton = page.getByRole("button", {
      name: "Sign in",
      exact: true,
    });
    this.error = page.getByRole("alert");
  }
  async open(next?: string) {
    await this.page.goto(
      "/login" + (next ? "?next=" + encodeURIComponent(next) : ""),
    );
  }
  async submitCredentials({
    email,
    password,
  }: {
    email: string;
    password: string;
  }) {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submitButton.click();
  }
  async signIn(role: keyof typeof accounts = "customer", next = "/stays") {
    await this.open(next);
    await this.submitCredentials(accounts[role]);
    await this.page.waitForURL((url) => url.pathname === next.split("?")[0]);
  }
}
