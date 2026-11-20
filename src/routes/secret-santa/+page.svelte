<script lang="ts">
    import { getFormatter } from "$lib/i18n";

    const t = getFormatter();
</script>

<svelte:head>
    <title>{$t("secret-santa.my-secret-santa")}</title>
</svelte:head>
