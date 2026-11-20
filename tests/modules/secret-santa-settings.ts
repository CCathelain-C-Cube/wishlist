import type { Locator, Page } from "@playwright/test";

export class SecretSantaSettings {
    private readonly enableCheckbox: Locator;

    constructor(page: Page) {
        const section = page.getByRole("region", { name: "Secret Santa" });
        this.enableCheckbox = section.getByLabel("Enable");
    }

    async enable() {
        await this.enableCheckbox.check();
        return this;
    }

    async disable() {
        await this.enableCheckbox.uncheck();
        return this;
    }

    getEnableCheckbox() {
        return this.enableCheckbox;
    }
}
