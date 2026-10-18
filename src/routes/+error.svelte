<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import AuthShell from '$lib/components/AuthShell.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import DitherButton from '$lib/components/ph/DitherButton.svelte';

	const notFound = $derived(page.status === 404);
</script>

<svelte:head>
	<title>{notFound ? 'Not found' : 'Something went wrong'} - Purdue Hackers ID</title>
</svelte:head>

<AuthShell>
	<PageTitle title={notFound ? 'Nothing here' : 'Something went wrong'}>
		{#if notFound}
			There is no page at <span class="font-mono">{page.url.pathname}</span>.
			<span class="font-mono">({page.status})</span>
		{:else}
			{page.error?.message ?? 'An unexpected error happened.'}
			<span class="font-mono">({page.status})</span>
		{/if}
	</PageTitle>

	<DitherButton href={resolve('/')} class="enter" style="--i: 1">Go to your account</DitherButton>
</AuthShell>
