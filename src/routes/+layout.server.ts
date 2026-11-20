import { toGroupInformation } from "$lib/dtos/group-mapper";
import { getConfig } from "$lib/server/config";
import { isSecretSantaEnabled } from "$lib/server/secret-santa/feature";
import { client } from "$lib/server/prisma";
import type { LayoutServerLoad } from "./$types";

export const load = (async ({ locals }) => {
    let groups: GroupInformation[] | null = null;
    let secretSantaEnabled = false;
    if (locals.user) {
        const membership = await client.userGroupMembership.findMany({
            where: {
                userId: locals.user.id
            },
            select: {
                group: true,
                active: true,
                role: true
            }
        });

        groups = membership.map(toGroupInformation).toSorted((a, b) => a.name.localeCompare(b.name, locals.locale));

        const activeGroup = groups.find((g) => g.active);
        if (activeGroup) {
            secretSantaEnabled = isSecretSantaEnabled(await getConfig(activeGroup.id));
        }
    }

    return { user: locals.user, groups, isProxyUser: locals.isProxyUser, locale: locals.locale, secretSantaEnabled };
}) satisfies LayoutServerLoad;
