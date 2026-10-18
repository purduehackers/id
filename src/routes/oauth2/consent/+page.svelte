<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import AuthShell from '$lib/components/AuthShell.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import Button from '$lib/components/ph/Button.svelte';
	import DitherButton from '$lib/components/ph/DitherButton.svelte';
	import Icon from '$lib/components/ph/Icon.svelte';
	import Notice from '$lib/components/ph/Notice.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head><title>Authorize {data.clientName} - Purdue Hackers ID</title></svelte:head>

<AuthShell>
	<PageTitle title="Authorize {data.clientName}">It is asking to:</PageTitle>

	<ul class="flex enter flex-col border-t border-border" style="--i: 1">
		{#each data.scopes as { scope, description } (scope)}
			<li class="flex items-start gap-3 border-b border-border py-3 text-[15px]">
				<Icon name="check" class="mt-0.5 text-ph-purple" />
				{description}
			</li>
		{/each}
	</ul>

	{#if form?.message}
		<Notice>{form.message}</Notice>
	{/if}

	<form method="post" class="flex enter flex-wrap items-center gap-3" style="--i: 2">
		<input type="hidden" name="query" value={data.query} />
		<DitherButton type="submit" formaction="?/allow&{data.query}">Allow</DitherButton>
		<Button type="submit" variant="outline" size="lg" formaction="?/deny&{data.query}">Deny</Button>
	</form>
</AuthShell>
