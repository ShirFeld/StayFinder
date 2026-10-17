import { accounts } from "../data/builders.js";

export class LoginPage {
  constructor(page) {
    this.page = page;
    this.email = page.getByLabel("Email address");
    this.password = page.getByLabel("Password", { exact: true });
    this.submitButton = page.getByRole("button", {
      name: "Sign in",
      exact: true,
    });
    this.error = page.getByRole("alert");
  }
  async open(next) {
    await this.page.goto(
      "/login" + (next ? "?next=" + encodeURIComponent(next) : ""),
    );
  }
  async submitCredentials({ email, password }) {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submitButton.click();
  }
  async signIn(role = "customer", next = "/stays") {
    await this.open(next);
    await this.submitCredentials(accounts[role]);
    await this.page.waitForURL((url) => url.pathname === next.split("?")[0]);
  }
}
