<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import AuthShell from '$lib/components/AuthShell.svelte';
	import LifeSandbox from '$lib/components/LifeSandbox.svelte';
	import PageTitle from '$lib/components/PageTitle.svelte';
	import DitherButton from '$lib/components/ph/DitherButton.svelte';
	import Link from '$lib/components/ph/Link.svelte';

	const notFound = $derived(page.status === 404);
</script>

<svelte:head>
	<title>{notFound ? 'Not found' : 'Something went wrong'} - Purdue Hackers ID</title>
</svelte:head>

{#if notFound}
	<LifeSandbox>
		<div class="flex flex-col gap-3">
			<h1 class="ph-headline text-5xl">Nothing here</h1>
			<p class="text-[15px] leading-[1.5]">
				There is no page at <span class="font-mono break-all">{page.url.pathname}</span>. The board
				is yours while you are here: draw some cells, then press play.
			</p>
		</div>
		<Link href={resolve('/')} class="w-fit font-mono text-[13px] font-semibold uppercase">
			Go to your account
		</Link>
	</LifeSandbox>
{:else}
	<AuthShell>
		<PageTitle title="Something went wrong">
			{page.error?.message ?? 'An unexpected error happened.'}
			<span class="font-mono">({page.status})</span>
		</PageTitle>
		<DitherButton href={resolve('/')} class="enter" style="--i: 1">Go to your account</DitherButton>
	</AuthShell>
{/if}
