<script lang="ts">
    import type { PageProps } from "./$types";
    import { getFormatter } from "$lib/i18n";
    import { resolve } from "$app/paths";
    import SecretSantaCard from "$lib/components/secret-santa/SecretSantaCard.svelte";

    const { data }: PageProps = $props();
    const t = getFormatter();
</script>

<svelte:head>
    <title>{$t("secret-santa.my-secret-santa")}</title>
</svelte:head>

<div class="flex flex-col gap-4">
    <div class="flex flex-row flex-wrap items-center justify-end gap-4">
        <a class="preset-filled-primary-500 btn w-min" href={resolve("/secret-santa/create")}>
            {$t("secret-santa.create")}
        </a>
    </div>
    {#if data.secretSantas.length === 0}
        <p class="subtext">{$t("secret-santa.empty")}</p>
    {:else}
        {#each data.secretSantas as secretSanta (secretSanta.id)}
            <SecretSantaCard {secretSanta} />
        {/each}
    {/if}
</div>
