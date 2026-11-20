import { expect, test } from "../fixtures";
import { UserMenu } from "../modules/user-menu";
import { enableSecretSanta } from "../helpers/secret-santa";

test("secret santa is disabled by default", async ({ page }) => {
    const response = await page.goto("/secret-santa");
    expect(response?.status()).toBe(404);
});

test("create action returns 404 when disabled", async ({ page, baseURL }) => {
    const response = await page.request.post("/secret-santa/create?/persist", {
        form: { name: "Office", description: "", participants: "[]", exclusions: "[]" },
        headers: { Origin: baseURL! }
    });
    expect(response.status()).toBe(404);
});

test("enabling in group settings makes the page available", async ({ page }) => {
    await enableSecretSanta(page);

    const response = await page.goto("/secret-santa");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "My Secret Santa" })).toBeVisible();
});

test("registry mode keeps it unavailable", async ({ page }) => {
    const settingsPage = await new UserMenu(page).manageGroup().then((p) => p.clickSettingsTab());
    const secretSanta = await settingsPage.getSecretSantaSettings();
    await secretSanta.enable();
    await settingsPage.saveSettings();
    await settingsPage.changeWishlistMode("registry");

    const response = await page.goto("/secret-santa");
    expect(response?.status()).toBe(404);

    await new UserMenu(page)
        .manageGroup()
        .then((p) => p.clickSettingsTab())
        .then((p) => p.getSecretSantaSettings())
        .then((s) => expect(s.getEnableCheckbox()).toBeDisabled());
});
