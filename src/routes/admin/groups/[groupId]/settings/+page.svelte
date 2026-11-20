<script lang="ts">
    import { enhance } from "$app/forms";
    import { invalidateAll } from "$app/navigation";
    import { General } from "$lib/components/admin/Settings";
    import type { PageProps } from "./$types";
    import { getFormatter } from "$lib/i18n";
    import { page } from "$app/state";
    import { toaster } from "$lib/components/toaster";

    const { data }: PageProps = $props();
    const t = getFormatter();

    const { config } = $derived(data);

    let saving = $state(false);
</script>

<form
    method="POST"
    use:enhance={() => {
        saving = true;

        return async ({ result }) => {
            saving = false;
            if (result.type === "success") {
                toaster.info({ description: $t("admin.settings-saved-toast") });
                // Refresh layout data so feature switches (e.g. the nav entry) apply immediately.
                await invalidateAll();
            }
        };
    }}
>
    <General
        {config}
        forGroup
        groupUserCount={data.membershipCount}
        groups={[]}
        hidden={false}
        listCount={data.listCount}
    />

    {#if page.form?.error}
        <span>{page.form.error}</span>
    {/if}

    <div class="flex w-full flex-row justify-end pt-6">
        <button class="preset-filled-primary-500 btn" disabled={saving} type="submit">
            {#if saving}
                <span class="loading loading-spinner loading-xs"></span>
            {/if}
            <span>{$t("general.save")}</span>
        </button>
    </div>
</form>
