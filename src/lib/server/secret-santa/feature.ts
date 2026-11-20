import { error } from "@sveltejs/kit";
import { getConfig } from "$lib/server/config";

export const isSecretSantaEnabled = (config: Pick<Config, "secretSanta" | "listMode">): boolean =>
    config.secretSanta.enable && config.listMode !== "registry";

export async function requireSecretSantaEnabled(groupId: string): Promise<void> {
    const config = await getConfig(groupId);
    if (!isSecretSantaEnabled(config)) {
        error(404, "Not found");
    }
}
