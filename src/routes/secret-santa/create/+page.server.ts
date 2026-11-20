import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { requireLogin } from "$lib/server/auth";
import { getActiveMembership } from "$lib/server/group-membership";
import { requireSecretSantaEnabled } from "$lib/server/secret-santa/feature";
import { parseCreateInput } from "$lib/server/secret-santa/input";
import { createSecretSanta, InvalidParticipantError, NoValidDrawError } from "$lib/server/secret-santa/service";
import { client } from "$lib/server/prisma";
import { getFormatter, getLocale } from "$lib/server/i18n";
import { logger } from "$lib/server/logger";
import { resolve } from "$app/paths";

export const load = (async () => {
    const user = requireLogin();
    const activeMembership = await getActiveMembership(user);
    await requireSecretSantaEnabled(activeMembership.groupId);

    const locale = getLocale();
    const memberships = await client.userGroupMembership.findMany({
        where: { groupId: activeMembership.groupId },
        select: { user: { select: { id: true, name: true, username: true } } }
    });
    const members = memberships.map((m) => m.user).sort((a, b) => a.name.localeCompare(b.name, locale));

    return { members };
}) satisfies PageServerLoad;

export const actions: Actions = {
    persist: async ({ request }) => {
        const user = requireLogin();
        const $t = await getFormatter();
        const activeMembership = await getActiveMembership(user);
        await requireSecretSantaEnabled(activeMembership.groupId);

        const form = Object.fromEntries(await request.formData());
        const parsed = parseCreateInput(form);
        if (!parsed.ok) {
            return fail(400, { error: $t(`errors.secret-santa-${parsed.code}`) });
        }

        try {
            await createSecretSanta(activeMembership.groupId, user.id, parsed.data);
        } catch (err) {
            if (err instanceof InvalidParticipantError) {
                return fail(400, { error: $t("errors.secret-santa-invalid-participant") });
            }
            if (err instanceof NoValidDrawError) {
                return fail(400, { error: $t("errors.secret-santa-no-valid-draw") });
            }
            logger.error({ err }, "Unable to create secret santa");
            throw err;
        }

        redirect(303, resolve("/secret-santa"));
    }
};
