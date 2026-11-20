import type { Page } from "@playwright/test";
import { UserMenu } from "../modules/user-menu";
import { test } from "../fixtures";

async function setSecretSanta(page: Page, enabled: boolean) {
    await new UserMenu(page)
        .manageGroup()
        .then((page) => page.clickSettingsTab())
        .then(async (page) => {
            await page.getSecretSantaSettings().then((s) => (enabled ? s.enable() : s.disable()));
            return page;
        })
        .then((page) => page.saveSettings());
}

export async function enableSecretSanta(page: Page) {
    await test.step("enable secret santa", () => setSecretSanta(page, true));
}

export async function disableSecretSanta(page: Page) {
    await test.step("disable secret santa", () => setSecretSanta(page, false));
}
