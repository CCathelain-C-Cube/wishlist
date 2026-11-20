import type { Actions, PageServerLoad } from "./$types";
import { requireLogin } from "$lib/server/auth";
import { getActiveMembership } from "$lib/server/group-membership";
import { requireSecretSantaEnabled } from "$lib/server/secret-santa/feature";
import { deleteSecretSanta, listSecretSantasForViewer } from "$lib/server/secret-santa/service";

export const load = (async () => {
    const user = requireLogin();
    const activeMembership = await getActiveMembership(user);
    await requireSecretSantaEnabled(activeMembership.groupId);

    const secretSantas = await listSecretSantasForViewer(activeMembership.groupId, user);
    return { secretSantas };
}) satisfies PageServerLoad;

export const actions: Actions = {
    delete: async ({ request }) => {
        const user = requireLogin();
        const activeMembership = await getActiveMembership(user);
        await requireSecretSantaEnabled(activeMembership.groupId);

        const id = (await request.formData()).get("id");
        await deleteSecretSanta(typeof id === "string" ? id : "", activeMembership.groupId, user);
    }
};
