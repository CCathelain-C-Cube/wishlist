import type { PageServerLoad } from "./$types";
import { requireLogin } from "$lib/server/auth";
import { getActiveMembership } from "$lib/server/group-membership";
import { requireSecretSantaEnabled } from "$lib/server/secret-santa/feature";

export const load = (async () => {
    const user = requireLogin();
    const activeMembership = await getActiveMembership(user);
    await requireSecretSantaEnabled(activeMembership.groupId);

    return {};
}) satisfies PageServerLoad;
