<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import AuthShell from '$lib/components/AuthShell.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import GrantDrop from '$lib/components/GrantDrop.svelte';
	import Button from '$lib/components/ph/Button.svelte';
	import DitherButton from '$lib/components/ph/DitherButton.svelte';
	import Icon from '$lib/components/ph/Icon.svelte';
	import '$lib/components/ph/link.css';
	import Notice from '$lib/components/ph/Notice.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const granted = $derived(form && 'granted' in form ? form.granted : null);

	let timer: ReturnType<typeof setTimeout> | undefined;

	// The meta refresh is the no-JS fallback.
	$effect(() => {
		if (!granted) return;
		const quick = matchMedia('(prefers-reduced-motion: reduce)').matches;
		timer = setTimeout(() => location.assign(granted), quick ? 400 : 1400);
		return () => clearTimeout(timer);
	});
</script>

<svelte:head>
	<title>Authorize {data.clientName} - Purdue Hackers ID</title>
	{#if granted}<noscript><meta http-equiv="refresh" content="3;url={granted}" /></noscript>{/if}
</svelte:head>

<AuthShell>
	{#if granted}
		<GrantDrop name={data.clientName} seed={data.clientId} />
		<p class="flex enter flex-wrap items-center gap-x-3 gap-y-1" style="--i: 6">
			Taking you back to {data.clientName}.
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- the app's redirect URI, same tab -->
			<a href={granted} class="ph-link" onclick={() => clearTimeout(timer)}>Continue now</a>
		</p>
	{:else}
		<PageTitle title="Authorize {data.clientName}">It is asking to:</PageTitle>

		<ul class="flex enter flex-col gap-1" style="--i: 1">
			{#each data.scopes as { scope, description } (scope)}
				<li class="flex items-start gap-3 py-1.5 text-[17px]">
					<Icon name="check" class="mt-1 text-primary" />
					{description}
				</li>
			{/each}
		</ul>

		{#if form && 'message' in form}
			<Notice>{form.message}</Notice>
		{/if}

		<form method="post" class="flex enter flex-wrap items-center gap-3" style="--i: 2">
			<input type="hidden" name="query" value={data.query} />
			<DitherButton type="submit" formaction="?/allow&{data.query}">Allow</DitherButton>
			<Button type="submit" variant="outline" size="lg" formaction="?/deny&{data.query}"
				>Deny</Button
			>
		</form>
	{/if}
</AuthShell>
