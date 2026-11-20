import { expect, test } from "../fixtures";
import { UserMenu } from "../modules/user-menu";
import { enableSecretSanta } from "../helpers/secret-santa";
import { createUser } from "../util";
import { CreateSecretSantaPage } from "../pageObjects/create-secret-santa.page";
import { SecretSantaPage } from "../pageObjects/secret-santa.page";

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

test.describe("create", () => {
    test("creates a secret santa and redirects to the overview", async ({ page, userData, userFactory }) => {
        await enableSecretSanta(page);
        const a = await userFactory.createUserPage({ group: userData.groups[0] });
        const b = await userFactory.createUserPage({ group: userData.groups[0] });

        const create = await new CreateSecretSantaPage(page).goto();
        await create.fillName("Office Santa");
        await create.fillDescription("Budget 20 euro");
        await create.selectParticipants(userData.name, a.user.name, b.user.name);
        await create.submit();

        await expect(page).toHaveURL(/\/secret-santa$/);
    });

    test("shows an error and creates nothing when no draw is possible", async ({ page, userData, userFactory }) => {
        await enableSecretSanta(page);
        const b = await userFactory.createUserPage({ group: userData.groups[0] });
        const c = await userFactory.createUserPage({ group: userData.groups[0] });

        const create = await new CreateSecretSantaPage(page).goto();
        await create.fillName("Impossible");
        await create.selectParticipants(userData.name, b.user.name, c.user.name);
        await create.addExclusion(userData.name, b.user.name);
        await create.addExclusion(userData.name, c.user.name);
        await create.submit();

        await create.expectError("No valid draw is possible with these exclusions");

        const overview = await new SecretSantaPage(page).goto();
        await overview.expectEmpty();
    });

    test("rejects fewer than 3 participants", async ({ page, userData, userFactory }) => {
        await enableSecretSanta(page);
        const b = await userFactory.createUserPage({ group: userData.groups[0] });

        const create = await new CreateSecretSantaPage(page).goto();
        await create.fillName("Too small");
        await create.selectParticipants(userData.name, b.user.name);
        await create.submit();

        await create.expectError("A Secret Santa needs at least 3 participants");
    });

    test("rejects participant from another group", async ({ page, userData, userFactory, baseURL }) => {
        await enableSecretSanta(page);
        const b = await userFactory.createUserPage({ group: userData.groups[0] });
        const adminPage = await userFactory.getAdminPage();
        const outsider = await createUser(adminPage.request);

        const response = await page.request.post("/secret-santa/create?/persist", {
            form: {
                name: "Sneaky",
                description: "",
                participants: JSON.stringify([userData.id, b.user.id, outsider.id]),
                exclusions: "[]"
            },
            headers: { Origin: baseURL!, Accept: "text/html" }
        });
        expect(response.status()).toBe(400);

        const overview = await new SecretSantaPage(page).goto();
        await overview.expectEmpty();
    });

    test("overlapping exclusions do not crash", async ({ page, userData, userFactory }) => {
        await enableSecretSanta(page);
        const b = await userFactory.createUserPage({ group: userData.groups[0] });
        const c = await userFactory.createUserPage({ group: userData.groups[0] });
        const d = await userFactory.createUserPage({ group: userData.groups[0] });

        const create = await new CreateSecretSantaPage(page).goto();
        await create.fillName("Overlap");
        await create.selectParticipants(userData.name, b.user.name, c.user.name, d.user.name);
        await create.addExclusion(userData.name, b.user.name, true);
        await create.addExclusion(userData.name, b.user.name, false);
        await create.submit();

        await expect(page).toHaveURL(/\/secret-santa$/);
    });
});
