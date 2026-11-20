<script lang="ts">
    import type { PageProps } from "./$types";
    import { enhance } from "$app/forms";
    import { getFormatter } from "$lib/i18n";
    import MarkdownEditor from "$lib/components/MarkdownEditor.svelte";
    import ParticipantPicker from "$lib/components/secret-santa/ParticipantPicker.svelte";
    import ExclusionEditor from "$lib/components/secret-santa/ExclusionEditor.svelte";
    import type { ExclusionInput } from "$lib/server/secret-santa/input";

    const { data, form }: PageProps = $props();
    const t = getFormatter();

    let selected: string[] = $state([]);
    let exclusions: ExclusionInput[] = $state([]);
    const participants = $derived(data.members.filter((m) => selected.includes(m.id)));
</script>

<svelte:head>
    <title>{$t("secret-santa.create")}</title>
</svelte:head>

<form class="flex flex-col gap-4" action="?/persist" method="POST" use:enhance>
    <label class="label" for="name">
        <span>{$t("secret-santa.name")}</span>
        <input id="name" name="name" class="input" autocomplete="off" type="text" />
    </label>

    <div>
        <label class="label mb-1" for="description">
            <span>{$t("secret-santa.description")}</span>
        </label>
        <MarkdownEditor id="description" name="description" placeholder={$t("secret-santa.description-placeholder")} />
    </div>

    <fieldset class="flex flex-col gap-y-2">
        <legend>{$t("secret-santa.participants")}</legend>
        <ParticipantPicker members={data.members} bind:selected />
    </fieldset>
    <input name="participants" type="hidden" value={JSON.stringify(selected)} />

    <fieldset class="flex flex-col gap-y-2">
        <legend>{$t("secret-santa.exclusions")}</legend>
        <p class="subtext">{$t("secret-santa.exclusions-hint")}</p>
        <ExclusionEditor {participants} bind:rows={exclusions} />
    </fieldset>
    <input name="exclusions" type="hidden" value={JSON.stringify(exclusions)} />

    {#if form?.error}
        <p class="text-invalid" role="alert">{form.error}</p>
    {/if}

    <div class="flex flex-row flex-wrap justify-between gap-4">
        <button
            class="preset-tonal-secondary border-secondary-500 btn w-min border"
            onclick={() => history.back()}
            type="button"
        >
            {$t("general.cancel")}
        </button>
        <button class="preset-filled-primary-500 btn w-min" type="submit">{$t("general.create")}</button>
    </div>
</form>
