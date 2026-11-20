import type { PageServerLoad } from "./$types";
import { requireLogin } from "$lib/server/auth";
import { getActiveMembership } from "$lib/server/group-membership";
import { requireSecretSantaEnabled } from "$lib/server/secret-santa/feature";
import { client } from "$lib/server/prisma";

export const load = (async () => {
    const user = requireLogin();
    const activeMembership = await getActiveMembership(user);
    await requireSecretSantaEnabled(activeMembership.groupId);

    // Minimal placeholder; replaced by the real overview in a later task.
    const count = await client.secretSanta.count({ where: { groupId: activeMembership.groupId } });

    return { count };
}) satisfies PageServerLoad;
