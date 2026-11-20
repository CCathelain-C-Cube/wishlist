import { expect, type Locator, type Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class CreateSecretSantaPage extends BasePage {
    private readonly header: Locator;

    constructor(page: Page) {
        super(page, "/secret-santa/create");
        this.header = page.getByRole("heading", { name: "Create Secret Santa" });
    }

    async at() {
        await expect(this.header).toBeVisible();
        return this;
    }

    async fillName(name: string) {
        await this.page.getByLabel("Name", { exact: true }).fill(name);
    }

    async fillDescription(description: string) {
        await this.page.locator("#description").fill(description);
    }

    async selectParticipants(...names: string[]) {
        for (const name of names) {
            await this.page.getByRole("checkbox", { name, exact: true }).check();
        }
    }

    async addExclusion(giver: string, receiver: string, twoWay = true) {
        await this.page.getByRole("button", { name: "Add Exclusion" }).click();
        const row = this.page.getByTestId("exclusion-row").last();
        await this.selectParticipant(row.getByLabel("Giver"), giver);
        await this.selectParticipant(row.getByLabel("Receiver"), receiver);
        const both = row.getByRole("checkbox", { name: "Both ways" });
        if (twoWay) await both.check();
        else await both.uncheck();
    }

    // Options are labelled "name (username)"; pick by display name.
    private async selectParticipant(select: Locator, name: string) {
        const value = await select.locator("option", { hasText: `${name} (` }).getAttribute("value");
        await select.selectOption(value!);
    }

    async submit() {
        await this.page.getByRole("button", { name: "Create", exact: true }).click();
    }

    async expectError(message: string) {
        await expect(this.page.getByText(message).first()).toBeVisible();
    }
}
