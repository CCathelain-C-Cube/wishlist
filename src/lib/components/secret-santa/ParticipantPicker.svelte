<script lang="ts">
    interface Props {
        members: { id: string; name: string; username: string }[];
        selected: string[];
    }

    let { members, selected = $bindable() }: Props = $props();
</script>

<div class="border-surface-500 rounded-container flex max-h-72 flex-col gap-y-2 overflow-y-auto border p-2">
    {#each members as member (member.id)}
        <label class="flex items-center gap-x-2">
            <input class="checkbox" aria-label={member.name} type="checkbox" value={member.id} bind:group={selected} />
            <span class="truncate">{member.name}</span>
            <span class="subtext truncate">{member.username}</span>
        </label>
    {/each}
</div>
