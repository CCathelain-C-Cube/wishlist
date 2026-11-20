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

    card(name: string) {
        return this.page
            .getByRole("heading", { name, level: 2 })
            .locator("xpath=ancestor::div[contains(@class,'card')][1]");
    }

    async expectCard(name: string) {
        await expect(this.page.getByRole("heading", { name, level: 2 })).toBeVisible();
    }

    async reveal(name: string) {
        await this.card(name).getByRole("button", { name: "Reveal" }).click();
        const recipient = this.card(name).getByTestId("recipient-name");
        await expect(recipient).toBeVisible();
        return (await recipient.textContent())!.trim();
    }

    async deleteSecretSanta(name: string) {
        await this.card(name).getByRole("button", { name: "Delete Secret Santa" }).click();
        await this.page.getByRole("dialog").getByRole("button", { name: "Confirm" }).click();
    }
}
