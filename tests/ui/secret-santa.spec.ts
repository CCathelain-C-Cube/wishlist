import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import type { GroupData, UserData } from "../types";
import { UserMenu } from "../modules/user-menu";
import { enableSecretSanta } from "../helpers/secret-santa";
import { createUser, randomString } from "../util";
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
    await enableSecretSanta(page);
    const enabled = await page.goto("/secret-santa");
    expect(enabled?.status()).toBe(200);

    await new UserMenu(page)
        .manageGroup()
        .then((p) => p.clickSettingsTab())
        .then((p) => p.changeWishlistMode("registry"));

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
        await new SecretSantaPage(page).expectCard("Office Santa");
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
        await new SecretSantaPage(page).expectCard("Overlap");
    });
});

async function createGroupWithManager(adminPage: Page, userData: UserData): Promise<GroupData> {
    const created = await adminPage.request.put("/api/groups", { data: { name: randomString(), createOnly: true } });
    expect(created.ok()).toBeTruthy();
    const { group }: { group: GroupData } = await created.json();
    const added = await adminPage.request.put(`/api/groups/${group.id}/users/${userData.id}`, {
        data: { manager: true }
    });
    expect(added.ok()).toBeTruthy();
    return group;
}

async function setActiveGroup(page: Page, userData: UserData, group: GroupData) {
    const response = await page.request.patch(`/api/users/${userData.id}/groups/${group.id}`, {
        data: { active: true }
    });
    expect(response.ok()).toBeTruthy();
}

async function setup(
    page: Page,
    userData: UserData,
    userFactory: {
        createUserPage: (o: { group: GroupData; manager?: boolean }) => Promise<{ user: UserData; page: Page }>;
    },
    opts: { extra?: number; name?: string } = {}
) {
    const name = opts.name ?? "Office Santa";
    await enableSecretSanta(page);
    const others = [];
    for (let i = 0; i < (opts.extra ?? 3); i++) {
        others.push(await userFactory.createUserPage({ group: userData.groups[0] }));
    }
    const create = await new CreateSecretSantaPage(page).goto();
    await create.fillName(name);
    await create.fillDescription("Budget 20 euro");
    await create.selectParticipants(userData.name, ...others.map((o) => o.user.name));
    await create.submit();
    await new SecretSantaPage(page).expectCard(name);
    return { name, others };
}

test.describe("overview", () => {
    test("each participant sees exactly one recipient, never themselves", async ({ page, userData, userFactory }) => {
        const { name, others } = await setup(page, userData, userFactory);
        const all = [{ user: userData, page }, ...others];
        const names = [];
        for (const { user, page: p } of all) {
            const overview = await new SecretSantaPage(p).goto();
            const recipient = await overview.reveal(name);
            expect(recipient).not.toBe(user.name);
            names.push(recipient);
        }
        expect([...names].sort()).toEqual(all.map((a) => a.user.name).sort());
    });

    test("page data does not contain other participants' recipients", async ({ page, userData, userFactory }) => {
        await setup(page, userData, userFactory);
        const response = await page.request.get("/secret-santa/__data.json");
        expect(response.ok()).toBeTruthy();
        const body = await response.text();
        expect(body).not.toContain("recipientId");
        expect(body.split('"recipient"').length - 1).toBe(1);
    });

    test("view wishlists link points at the recipient", async ({ page, userData, userFactory }) => {
        const { name, others } = await setup(page, userData, userFactory);
        const overview = await new SecretSantaPage(page).goto();
        const recipient = await overview.reveal(name);
        const target = others.find((o) => o.user.name === recipient)!;
        await expect(overview.card(name).getByRole("link", { name: /View .* wishlists/ })).toHaveAttribute(
            "href",
            `/lists?users=${target.user.id}`
        );
    });

    test("plain member who is not a participant does not see it", async ({ page, userData, userFactory }) => {
        await setup(page, userData, userFactory);
        const member = await userFactory.createUserPage({ group: userData.groups[0], manager: false });
        const overview = await new SecretSantaPage(member.page).goto();
        await overview.expectEmpty();
    });

    test("group manager who is not a participant sees it without a recipient and can delete", async ({
        page,
        userData,
        userFactory
    }) => {
        const { name } = await setup(page, userData, userFactory);
        const manager = await userFactory.createUserPage({ group: userData.groups[0], manager: true });
        const overview = await new SecretSantaPage(manager.page).goto();
        await overview.expectCard(name);
        await expect(manager.page.getByText("You are not participating in this Secret Santa")).toBeVisible();
        await overview.deleteSecretSanta(name);
        await overview.expectEmpty();
    });

    test("plain participant who is not the creator cannot delete", async ({ page, userData, userFactory, baseURL }) => {
        await enableSecretSanta(page);
        const plain = await userFactory.createUserPage({ group: userData.groups[0], manager: false });
        const c = await userFactory.createUserPage({ group: userData.groups[0], manager: false });
        const create = await new CreateSecretSantaPage(page).goto();
        await create.fillName("Plain");
        await create.selectParticipants(userData.name, plain.user.name, c.user.name);
        await create.submit();
        const creatorOverview = await new SecretSantaPage(page).at();
        await creatorOverview.expectCard("Plain");

        const overview = await new SecretSantaPage(plain.page).goto();
        await overview.expectCard("Plain");
        await expect(overview.card("Plain").getByRole("button", { name: "Delete Secret Santa" })).toHaveCount(0);

        const secretSantaId = await creatorOverview.card("Plain").locator("input[name=id]").inputValue();
        const response = await plain.page.request.post("/secret-santa?/delete", {
            form: { id: secretSantaId },
            headers: { Origin: baseURL!, Accept: "text/html" }
        });
        expect(response.status()).toBe(403);
        await overview.goto();
        await overview.expectCard("Plain");
    });

    test("secret santa from another group is not visible and cannot be deleted", async ({
        page,
        userData,
        userFactory,
        baseURL
    }) => {
        const { name } = await setup(page, userData, userFactory);
        const overview = new SecretSantaPage(page);
        const secretSantaId = await overview.card(name).locator("input[name=id]").inputValue();
        const adminPage = await userFactory.getAdminPage();
        const groupB = await createGroupWithManager(adminPage, userData);
        await setActiveGroup(page, userData, groupB);
        await page.goto("/");
        await enableSecretSanta(page);

        await overview.goto();
        await overview.expectEmpty();
        const response = await page.request.post("/secret-santa?/delete", {
            form: { id: secretSantaId },
            headers: { Origin: baseURL!, Accept: "text/html" }
        });
        expect(response.status()).toBe(404);

        await setActiveGroup(page, userData, userData.groups[0]);
        await overview.goto();
        await overview.expectCard(name);
    });

    test("deleted participant shows participant removed", async ({ page, userData, userFactory }) => {
        const { name, others } = await setup(page, userData, userFactory, { extra: 2 });
        const adminPage = await userFactory.getAdminPage();
        const removed = others[0];
        const response = await adminPage.request.delete(`/api/users/${removed.user.id}`);
        expect(response.ok()).toBeTruthy();

        // Exactly one remaining participant drew the removed user.
        const candidates = [{ page }, others[1]];
        let removedCount = 0;
        for (const c of candidates) {
            const overview = await new SecretSantaPage(c.page).goto();
            await overview.expectCard(name);
            removedCount += await overview
                .card(name)
                .getByText("Participant removed. Delete and recreate this Secret Santa.")
                .count();
        }
        expect(removedCount).toBe(1);
    });
});

test.describe("navigation entry", () => {
    test("nav entry hidden when disabled", async ({ page }) => {
        await page.goto("/lists");
        await expect(page.getByRole("link", { name: "My Secret Santa" })).toHaveCount(0);
    });

    test("nav entry appears right after enabling, without a reload", async ({ page }) => {
        await page.goto("/lists");
        await expect(page.getByRole("link", { name: "My Secret Santa" })).toHaveCount(0);
        await enableSecretSanta(page);
        await expect(page.getByRole("link", { name: "My Secret Santa" })).toBeVisible();
    });

    test("nav entry visible when enabled and navigates to the overview", async ({ page }) => {
        await enableSecretSanta(page);
        await page.goto("/lists");
        await page.getByRole("link", { name: "My Secret Santa" }).click();
        await expect(page).toHaveURL(/\/secret-santa$/);
    });

    test("nav entry follows the active group", async ({ page, userData, userFactory }) => {
        await enableSecretSanta(page);
        const adminPage = await userFactory.getAdminPage();
        const groupB = await createGroupWithManager(adminPage, userData);

        await setActiveGroup(page, userData, groupB);
        await page.goto("/lists");
        await expect(page.getByRole("link", { name: "My Secret Santa" })).toHaveCount(0);

        await setActiveGroup(page, userData, userData.groups[0]);
        await page.goto("/lists");
        await expect(page.getByRole("link", { name: "My Secret Santa" })).toBeVisible();
    });
});
