<script lang="ts">
    import type { SecretSantaView } from "$lib/secret-santa-types";
    import { getFormatter } from "$lib/i18n";
    import { resolve } from "$app/paths";
    import { enhance } from "$app/forms";
    import Markdown from "$lib/components/Markdown.svelte";
    import ConfirmModal from "$lib/components/modals/ConfirmModal.svelte";

    interface Props {
        secretSanta: SecretSantaView;
    }

    const { secretSanta }: Props = $props();
    const t = getFormatter();

    let revealed = $state(false);
    let deleteForm: HTMLFormElement | undefined = $state();
</script>

<div class="card preset-filled-surface-100-900 inset-ring-surface-200-800 flex flex-col gap-4 p-4 inset-ring">
    <h2 class="h4">{secretSanta.name}</h2>

    {#if secretSanta.isParticipant}
        {#if secretSanta.recipientRemoved}
            <p class="text-error-500">{$t("secret-santa.participant-removed")}</p>
        {:else if secretSanta.recipient}
            <div class="flex flex-row flex-wrap items-center gap-2">
                <span>{$t("secret-santa.you-are-giving-to")}</span>
                {#if revealed}
                    <strong data-testid="recipient-name">{secretSanta.recipient.name}</strong>
                {:else}
                    <button class="preset-filled-primary-500 btn btn-sm" onclick={() => (revealed = true)}>
                        {$t("secret-santa.reveal")}
                    </button>
                {/if}
            </div>
            {#if revealed}
                <a class="anchor" href={resolve("/lists") + `?users=${secretSanta.recipient.id}`}>
                    {$t("secret-santa.view-wishlists", { values: { name: secretSanta.recipient.name } })}
                </a>
            {/if}
        {/if}
    {:else}
        <p class="subtext">{$t("secret-santa.not-participating")}</p>
    {/if}

    <section class="flex flex-col gap-2">
        <h3 class="h5">{$t("secret-santa.details")}</h3>
        {#if secretSanta.description}
            <Markdown source={secretSanta.description} />
        {/if}
        <div>
            <span class="font-semibold">{$t("secret-santa.participants")}:</span>
            {secretSanta.participants.map((p) => p.name).join(", ")}
        </div>
        {#if secretSanta.exclusions.length > 0}
            <div>
                <span class="font-semibold">{$t("secret-santa.exclusions")}:</span>
                <ul class="list-inside list-disc">
                    {#each secretSanta.exclusions as e (e.giverId + "\u0000" + e.receiverId)}
                        <li>{e.giverName} {e.twoWay ? "↔" : "→"} {e.receiverName}</li>
                    {/each}
                </ul>
            </div>
        {/if}
    </section>

    {#if secretSanta.canDelete}
        <form bind:this={deleteForm} class="hidden" action="?/delete" method="POST" use:enhance>
            <input name="id" type="hidden" value={secretSanta.id} />
        </form>
        <ConfirmModal
            description={$t("secret-santa.delete-confirm", { values: { name: secretSanta.name } })}
            onConfirm={() => deleteForm?.requestSubmit()}
        >
            {#snippet trigger(props)}
                <button class="preset-tonal-error inset-ring-error-500 btn w-fit inset-ring" {...props}>
                    {$t("secret-santa.delete")}
                </button>
            {/snippet}
        </ConfirmModal>
    {/if}
</div>
