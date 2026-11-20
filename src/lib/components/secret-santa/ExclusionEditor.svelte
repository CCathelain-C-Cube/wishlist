<script lang="ts">
    import { getFormatter } from "$lib/i18n";
    import type { ExclusionInput } from "$lib/server/secret-santa/input";

    interface Props {
        participants: { id: string; name: string }[];
        rows: ExclusionInput[];
    }

    let { participants, rows = $bindable() }: Props = $props();
    const t = getFormatter();

    // Drop rows referencing participants that were deselected.
    $effect(() => {
        const ids = new Set(participants.map((p) => p.id));
        if (rows.some((r) => !ids.has(r.giverId) || !ids.has(r.receiverId))) {
            rows = rows.filter((r) => ids.has(r.giverId) && ids.has(r.receiverId));
        }
    });

    const add = () => {
        const [giver, receiver] = participants;
        if (!giver || !receiver) return;
        rows = [...rows, { giverId: giver.id, receiverId: receiver.id, twoWay: true }];
    };
    const remove = (index: number) => {
        rows = rows.filter((_, i) => i !== index);
    };
</script>

<div class="flex flex-col gap-y-2">
    {#each rows as row, i (i)}
        <div class="flex flex-row flex-wrap items-center gap-2" data-testid="exclusion-row">
            <label class="flex items-center gap-x-2">
                <span>{$t("secret-santa.giver")}</span>
                <select class="select w-auto" bind:value={row.giverId}>
                    {#each participants as p (p.id)}
                        <option value={p.id}>{p.name}</option>
                    {/each}
                </select>
            </label>
            <label class="flex items-center gap-x-2">
                <span>{$t("secret-santa.receiver")}</span>
                <select class="select w-auto" bind:value={row.receiverId}>
                    {#each participants as p (p.id)}
                        <option value={p.id}>{p.name}</option>
                    {/each}
                </select>
            </label>
            <label class="flex items-center gap-x-2">
                <input class="checkbox" type="checkbox" bind:checked={row.twoWay} />
                <span>{$t("secret-santa.two-way")}</span>
            </label>
            <button
                class="flex items-center"
                aria-label={$t("secret-santa.remove-exclusion")}
                onclick={() => remove(i)}
                type="button"
            >
                <iconify-icon icon="ion:close"></iconify-icon>
            </button>
        </div>
    {/each}
    <button
        class="preset-tonal-primary border-primary-500 btn btn-sm w-fit border"
        disabled={participants.length < 2}
        onclick={add}
        type="button"
    >
        {$t("secret-santa.add-exclusion")}
    </button>
</div>
