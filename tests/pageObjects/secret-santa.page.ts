import { expect, type Locator, type Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class SecretSantaPage extends BasePage {
    private readonly header: Locator;

    constructor(page: Page) {
        super(page, "/secret-santa");
        this.header = page.getByRole("heading", { name: "My Secret Santa" });
    }

    async at() {
        await expect(this.header).toBeVisible();
        return this;
    }

    async expectEmpty() {
        await expect(this.page.getByText("No Secret Santas in this group yet")).toBeVisible();
    }

    async clickCreate() {
        await this.page.getByRole("link", { name: "Create Secret Santa" }).click();
    }
}
