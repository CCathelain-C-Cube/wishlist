<script lang="ts">
    import SettingsGroup from "../SettingsGroup.svelte";
    import Setting from "../Setting.svelte";
    import { getFormatter } from "$lib/i18n";

    interface Props {
        config: Pick<Config, "secretSanta" | "listMode">;
        forGroup?: boolean;
    }

    const { config, forGroup = false }: Props = $props();
    const t = getFormatter();

    let enabled = $derived(config.secretSanta.enable);
    const registryDisabled = $derived(forGroup && config.listMode === "registry");
</script>

<SettingsGroup title={$t("admin.secret-santa")}>
    <Setting>
        <label class="checkbox-label">
            <input
                id="enableSecretSanta"
                name="enableSecretSanta"
                class="checkbox"
                disabled={registryDisabled}
                type="checkbox"
                bind:checked={enabled}
            />
            <span>{$t("general.enable")}</span>
        </label>
        {#snippet description()}
            {registryDisabled ? $t("admin.secret-santa-registry-disabled") : $t("admin.secret-santa-tooltip")}
        {/snippet}
    </Setting>
</SettingsGroup>
